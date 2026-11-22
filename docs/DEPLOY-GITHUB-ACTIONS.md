# GitHub Actions CI/CD

本文记录当前已启用的自动化边界。生产 ECS 尚未接入 GitHub Actions；本阶段不会连接服务器、创建 Secrets 或执行 SSH 部署。

## 1. 工作流

### `CI` (`.github/workflows/ci.yml`)

触发条件：

- 所有 Pull Request；
- 推送到 `main`。

三个任务并行运行：

- **Backend**：Python 3.12，使用 `uv sync --locked --group dev`，执行 pytest 覆盖率、Ruff、mypy 和 Bandit。测试使用 SQLite、mock 微信配置和非生产测试密钥，不访问真实 MySQL、Redis 或微信 API。
- **Admin**：Node 20，在 `backend/admin` 执行 `npm ci`、类型检查和生产构建。
- **Miniprogram**：Node 20，在 `miniprogram` 执行类型检查、Vitest 和微信小程序构建，并上传构建产物。小程序不会自动上传微信平台。

工作流只申请 `contents: read` 权限，并会取消同一分支上已过时的运行。

### `Publish images` (`.github/workflows/release.yml`)

该工作流由 `CI` 在 `main` 上成功完成后触发。它会：

1. 检出已经通过 CI 的 commit SHA；
2. 构建 `backend/Dockerfile` 和 `backend/admin/Dockerfile`；
3. 为 `linux/amd64` 镜像推送 GHCR；
4. 只推送不可变的 `sha-<commit-sha>` 标签；
5. 在 GitHub Actions Summary 中记录镜像引用。

部署时必须使用 `sha-<commit-sha>` 标签，不要使用 `main` 或 `latest` 作为生产版本标识。当前发布工作流没有 ECS 主机、SSH 私钥或生产环境变量，也不会自动部署。

GHCR 镜像地址格式为：

```text
ghcr.io/<GitHub owner>/<repository>/backend-web:sha-<commit-sha>
ghcr.io/<GitHub owner>/<repository>/backend-admin:sha-<commit-sha>
```

首次发布后，在仓库的 **Packages** 页面确认包的可见性和访问权限。生产服务器拉取私有包时，需要使用专门的只读 GitHub token；不要使用个人账号密码。

## 2. 首次验证 CI

合并前可在本地按工作流复核：

```bash
cd backend
uv sync --locked --group dev
uv run pytest --cov=src --cov-report=term-missing
uv run ruff check src tests
uv run mypy src
uv run bandit -r src/

cd admin
npm ci --no-audit --no-fund
npm run typecheck
npm run build

cd ../../miniprogram
npm ci --no-audit --no-fund
npm run type-check
npm run test
npm run build:mp-weixin
```

在 GitHub 上先观察 PR 的 CI，再观察 `main` 的 CI 和随后出现的 `Publish images`。检查发布工作流检出的 SHA 与通过 CI 的 SHA 相同。

## 3. 在 ECS 验证 GHCR 网络访问

以下命令在 ECS 上执行，不要把 token 写入命令历史或提交到仓库。先做不带认证的网络和 DNS 检查：

```bash
getent hosts ghcr.io
curl -fsSI https://ghcr.io/v2/
docker version
docker compose version
```

`https://ghcr.io/v2/` 返回 `401 Unauthorized` 通常表示网络已连通，GHCR 正在要求认证；DNS 失败、连接超时或 TLS 错误才是网络/安全组问题。若 ECS 无法访问，应检查出方向 443、防火墙、代理和 DNS，不要为了绕过限制开放数据库或 Redis 端口。

获得只读 GHCR token 后，在 ECS 临时登录并测试一个已发布的 SHA 镜像：

```bash
read -r -s GHCR_READ_TOKEN
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u '<GitHub 用户名或机器账号>' --password-stdin
docker pull ghcr.io/<owner>/<repository>/backend-web:sha-<commit-sha>
docker image inspect ghcr.io/<owner>/<repository>/backend-web:sha-<commit-sha> --format '{{index .RepoDigests 0}}'
docker logout ghcr.io
unset GHCR_READ_TOKEN
```

若镜像是私有的，token 至少需要读取 packages 的权限。不要在聊天、日志或工单中粘贴 token；测试完成后应删除临时 token，并优先使用专用机器账号或 GitHub App，而不是个人长期凭据。

## 4. ECS 部署账号、目录和 SSH

当前项目文档中的生产目录是 `/opt/projects/mattress-ux`，服务器为 Alibaba Cloud Linux 3、x86_64。建议创建不能登录 root 的专用账号，由该账号执行 Docker Compose：

```bash
sudo useradd --create-home --shell /bin/bash mattress-deploy
sudo usermod --append --groups docker mattress-deploy
sudo install -d -o mattress-deploy -g mattress-deploy -m 0750 /opt/projects/mattress-ux
sudo -u mattress-deploy docker compose version
```

将 Docker socket 权限视为 root 等级：`docker` 组账号可以控制主机。该账号只应服务于本项目，不用于日常登录；SSH 安全组只允许可信来源访问 22 端口，公网只开放反向代理所需的 80/443。

在本地生成专用密钥，不覆盖现有密钥：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mattress_ux_deploy -C 'github-actions mattress-ux deploy'
ssh-copy-id -i ~/.ssh/mattress_ux_deploy.pub mattress-deploy@<ECS_IP>
ssh -i ~/.ssh/mattress_ux_deploy mattress-deploy@<ECS_IP> 'id && docker compose version && test -w /opt/projects/mattress-ux'
```

如果 ECS 禁止 `ssh-copy-id`，请通过云控制台或现有管理员会话把公钥追加到：

```text
/home/mattress-deploy/.ssh/authorized_keys
```

并确认目录权限为 `0700`、文件权限为 `0600`，公钥内容不换行损坏。GitHub Actions 使用私钥时，应保存完整的私钥文本，不要保存 `.pub` 文件。

## 5. 生产配置准备（暂不启用）

后续启用 ECS 部署前，需要先准备：

- 生产专用 Compose 文件，所有应用服务使用 GHCR 的 SHA 镜像，不使用 `build:`；
- ECS 本地保存的生产 `.env`，GitHub 不回传数据库密码、微信密钥或 JWT 密钥；
- GitHub Environment `production`，其中保存 SSH 私钥、主机名和只读 GHCR 凭据，并配置 required reviewers；
- 发布脚本，执行 `docker compose config --quiet`、备份/迁移检查、`docker compose up -d --no-build` 和健康检查；
- 回滚方案：重新指定上一次成功的 SHA/digest，不执行 `docker compose down -v`，不删除 MySQL、Redis 或上传文件卷。

在这些条件完成前，不要添加自动 SSH 部署步骤，也不要把生产凭据放入仓库级明文变量。小程序继续由人工使用微信开发者工具上传；如需自动上传，应另行设计受保护的 `workflow_dispatch` 流程。
