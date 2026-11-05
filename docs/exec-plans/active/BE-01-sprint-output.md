# BE-01 Sprint Output — 后端基座初始化（RuoYi-FastAPI）

> 状态：submitted（待 Hermes 复跑验收，未自评 done）

## 1. 改了什么

| 项 | 内容 |
|----|------|
| 基座引入 | insistence/RuoYi-FastAPI `master` 浅克隆后移除其 `.git`，全量 2755 文件迁入 `backend/`（主仓统一管理，`backend/` 内无嵌套 `.git`）。框架代码零改动，`sys_`/`gen_` 表结构与官方配置保持原样。 |
| docker compose | 新增 `backend/docker-compose.yml`（跟随上游 `docker-compose.my.yml` MySQL 版官方部署，默认 vue3 前端），补 mysql/redis named volume 持久化（上游 README 明确警告默认无持久化）。 |
| 镜像构建修复 | compose 通过 Dockerfile 自带 ARG 传入两项构建参数（不改框架 Dockerfile）：`PIP_INDEX_URL`（清华源本机 403 → 阿里云镜像）；`PYTHON_VERSION=3.12`（见「踩坑记录」）。 |
| 业务表 | 本任务未创建任何 `gin_` 业务表（按任务要求）。 |

提交记录：
- `ca1f035` chore(backend): 引入 RuoYi-FastAPI 基座（2755 files）
- `be6d64c` feat(backend): 提供 docker-compose.yml（api+admin+mysql8+redis 一键拉起）
- `a61c346` fix(backend): docker compose 换阿里云 pip 源 + 后端镜像升 Python 3.12

## 2. 实际服务端口（容器内端口 → 宿主机端口）

| 服务 | 容器名 | 宿主机端口 | 容器端口 | 说明 |
|------|--------|-----------|---------|------|
| Admin 前端（nginx） | ruoyi-frontend | **12580** | 80 | 浏览器访问 http://localhost:12580 |
| Admin/后端 API | ruoyi-backend-my | **19099** | 9099 | 直接访问后端（root_path=/docker-api） |
| Admin API（经 nginx） | — | **12580** | — | 前缀 `/docker-api/*` 代理到 backend |
| MySQL 8 | ruoyi-mysql | **13306** | 3306 | root/root，库名 `ruoyi-fastapi` |
| Redis | ruoyi-redis | **16379** | 6379 | 无密码 |

**重要：** Docker 部署模式实际 API 前缀是 **`/docker-api`**（前端 `.env.docker` 与后端 `.env.dockermy` 的 `APP_ROOT_PATH=/docker-api`），任务描述里的 `/dev-api` 是本地 dev 模式（`ruoyi app run --env=dev`，端口 9099）使用的前缀，Docker 模式下不适用。探活/集成测试请用 `/docker-api`。

## 3. 验证命令与实际输出

```bash
# ① 环境冒烟
bash init.sh
# 实际输出：… docker ok → [3/5] 后端基座 列出 4 个容器 up → OK: 环境冒烟检查完成

# ② 探活：admin 登录页
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:12580/        # → 200
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:12580/login   # → 200

# ③ 探活：API 返回 JSON（Docker 模式实际前缀 /docker-api）
curl -sS http://localhost:12580/docker-api/captchaImage | head -c 120
# → {"code":200,"msg":"操作成功","captchaEnabled":true,"registerEnabled":false,"img":"iVBORw0KGgo…"

# ③' 直连后端
curl -sS http://localhost:19099/captchaImage | head -c 120
# → {"code":200,"msg":"操作成功",…}

# ④ 无嵌套 .git
find backend -name ".git" -maxdepth 3 | wc -l   # → 0

# ⑤ 框架表保持原样（未建业务表）
docker exec ruoyi-mysql mysql -uroot -proot -e "USE \`ruoyi-fastapi\`; SHOW TABLES;" | tail -n +2
# → 52 张 sys_*、2 张 gen_*、1 张 apscheduler_*（调度器运行时自建），共 55 张
```

容器状态（`docker compose -f backend/docker-compose.yml ps`）：4 个容器全部 `Up`，mysql/redis 均 `(healthy)`；backend 日志首行 `🚀 RuoYi-FastAPI启动成功`。

## 4. 踩坑记录（供后续任务参考）

1. **PyPI 清华源本机网络 403**：`Dockerfile.my` 默认 `PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple` 在当前网络返回 403。已在 compose 通过官方 ARG 覆盖为阿里云镜像（`https://mirrors.aliyun.com/pypi/simple/`），可用环境变量再覆盖。
2. **sqlglotc 30.23.0 在 Python 3.10 源码编译会崩**：`sqlglot[rs]==30.23.0` 的 Rust 扩展 `sqlglotc` 仅发布 cp311+ 预编译轮；3.10 环境下 pip 回退源码编译 Rust 核心（耗时 25+ min 且生成的核心与 sqlglot 30.23.0 Python 包不匹配），启动报 `AttributeError: module 'sqlglot.expressions' has no attribute 'SortArray'`。改用项目 CI 同款 Python 3.12（Dockerfile.my 的 `ARG PYTHON_VERSION` 可覆盖）拿到官方 cp312 预编译轮解决。
3. **Docker Hub 拉取偶发 EOF**：`docker pull` 偶发 `registry-1.docker.io EOF`，重试即可恢复；已在首次构建前预拉全部基础镜像（mysql:8.0 / redis:latest / python:3.12 / node:22-slim / nginx:latest）。

## 5. 残留风险与后续动作

- **传输加密密钥为上游示例值**：`backend/ruoyi-fastapi-backend/.env.dockermy` 中的 `TRANSPORT_CRYPTO_PUBLIC_KEY/PRIVATE_KEY` 是上游 README 自述的示例密钥对，开发可跑通，**上线前必须替换为正式密钥**（见 `backend/ruoyi-fastapi-backend/docs/transport_crypto_deployment.md`）。
- **日志聚合 Redis Stream 超时告警**：backend 日志偶发 `日志聚合消费异常: Timeout reading from ruoyi-redis:6379` 与调度器 `maximum number of running instances reached` 警告。不影响 HTTP 服务（探活 JSON 正常返回），属上游调度器/日志组件运行时告警，暂不阻塞，后续 BE 任务如需可调 `APP_LOG_*` / 调度间隔。
- **首次构建较慢**：后端 pip（全量依赖含 pandas）+ 前端 pnpm install + vite build，首次约 15–25 min；docker layer cache 命中后二次启动秒级。
- **`backend/` 引入了上游全部内容**（含 react/vue2 前端工程、test 工程、.github CI），供后续按需裁剪；本次未删上游文件，保持基座可跟随上游升级。
- **Designer 设计稿 JPG**（`jp/` 目录）与 `tasks.json`（BE-01 → submitted）留在工作区未提交：前者非本任务产物，后者按约定由 Hermes 提交。

## 6. 本地复跑入口

```bash
cd backend
docker compose up -d          # 首次或镜像变更时加 --build
docker compose ps             # 应见 4 个容器
open http://localhost:12580   # admin 登录页
```