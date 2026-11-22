# Docker Compose 部署（管理后台 + API）

## 范围与注意事项

Compose 启动管理后台 Nginx、FastAPI、MySQL 和 Redis。Node 只在镜像构建时使用，服务器无需安装 Node。当前项目不包含后台队列或 worker；尚无必须异步执行的生产业务。审计日志按现有保留策略存储，后续如需自动清理应单独实现并验证，不依赖未运行的 worker。

**上线前必读：当前默认端口映射会对外开放 8080、8000、13306、6379；不能直接用于公网生产。** 至少通过云安全组及主机防火墙限制 8000、13306、6379，只允许可信来源访问后台；公网访问必须另行配置 HTTPS 和访问控制。小程序正式使用还需要备案 HTTPS 域名、证书、微信后台配置合法域名及真实微信凭据；本文的 HTTP 命令仅供内网验收。

图片当前使用本地文件存储，并非云对象存储。数据库、Redis、上传文件分别使用 Docker 命名卷；备份都需要覆盖。不要执行 `docker compose down -v`，否则会删除这些卷及数据。

## 1. 准备

安装 Docker Engine 和 Docker Compose 插件，并确认 `docker compose version` 可用。准备项目代码，进入 `backend` 目录：

```bash
cd /path/to/mattress-ux/backend
cp -n .env.example .env
```

已有 `.env` 时不要覆盖。使用编辑器修改 `.env`，不要将其提交或发送给他人。以下为生产所需项目，值按实际环境填写：

- `APP_ENV=production`、`DEBUG=False`、`DB_ENGINE=mysql`。
- `DB_NAME`、`DB_USER`、`DB_PASSWORD`、`DB_ROOT_PASSWORD`：设置数据库名、账号和独立强密码；首次创建 MySQL 数据卷后修改环境变量不会自动修改数据库内已有密码。
- `SECRET_KEY`、`WX_JWT_SECRET_KEY`：分别设置不同随机密钥，每个不少于 32 字符（可使用 `openssl rand -hex 32` 生成）。
- `SWAGGER_UI_PASSWORD`：至少 8 字符，设独立强密码。
- `ADMIN_INIT_PASSWORD`：设置初始管理员强密码；仅在数据库没有后台用户时生效，已有用户需通过其他安全方式改密。
- `WX_APPID`、`WX_SECRET`：填写真实微信小程序凭据；`WX_CODE2SESSION_MOCK=false`。
- `CORS_ORIGINS`：填写实际允许的 HTTPS 来源，逗号分隔，不要包含 localhost。
- `STORAGE_DRIVER=local`；`UPLOAD_DIR` 由 Compose 固定为 `/app/uploads`，不要改成其他路径，否则不会写入持久卷。

切勿使用示例密码上线。`.env.example` 默认是开发配置，复制后不能直接作为生产配置。`ADMIN_PORT` 可在 `.env` 设置，默认 8080。

## 2. 从已有容器迁移图片（仅已有部署需要）

旧 Compose 的 web 容器没有挂载 uploads 卷，重建容器前必须先备份图片，否则可能丢失。先停止写入（禁止运营上传），再执行：

```bash
mkdir -p ./uploads-backup
docker cp mattress_api:/app/uploads/. ./uploads-backup/
```

如旧环境显式使用过其他 `UPLOAD_DIR`，先确认其实际位置并备份对应目录；不确定时不要重建容器。记录目录大小、文件数，并单独备份数据库。以下启动后再按第 4 节恢复图片。全新部署跳过本节。

## 3. 启动

确认 8080 未被现有 Vite 或其他进程占用；否则先停止该进程，或在 `.env` 中设置空闲的 `ADMIN_PORT`。若更新已有服务，请先完成上面的备份。

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

等待服务就绪。后台访问 `http://服务器IP:8080/`（若修改端口则替换）。`admin` 通过容器网络将 `/api/`、`/uploads/` 转发给 `web`。

```bash
curl -i http://127.0.0.1:8080/
curl -i http://127.0.0.1:8080/login
curl -i http://127.0.0.1:8080/api/v1/base/health
```

期望均为 HTTP 200；API 健康检查应返回 JSON。再用真实管理员账号登录、打开产品列表、上传一张测试图并刷新查看。首次初始化账号只在数据库无后台用户时创建，不要假设旧数据库密码会被环境变量重置。

## 4. 恢复旧图片

仅对第 2 节备份过旧容器图片的部署执行。启动后先确认 web healthy，再复制并修正权限（仅作用于上传目录）：

```bash
docker cp ./uploads-backup/. mattress_api:/app/uploads/
docker exec --user root mattress_api chown -R app:app /app/uploads
```

核对备份和容器内文件数量、大小；在管理后台打开历史图片并尝试上传新图片。若旧路径不在 `/app/uploads`，需先确认真实路径与对应的 URL 映射，不能盲目恢复。

## 5. 运维和备份

```bash
docker compose ps
docker compose logs --tail=100 admin web mysql redis
docker compose restart admin
docker compose down                 # 不加 -v，保留命名卷
```

升级前先备份 MySQL（使用 `mysqldump` 的一致性备份方式）、`uploads_data` 及必要的 Redis 数据，并验证恢复；不要将备份留在公网目录。然后获取新代码、执行 `docker compose up -d --build`，回归检查登录、图片、核心业务。数据迁移与回滚需要按版本评估，不能仅靠回滚镜像。

可用 `docker compose config --volumes` 查询实际卷名。配置中的数据库和 Redis 端口目前仍会对宿主机所有网卡发布；应在部署前将它们绑定到 `127.0.0.1` 或移除端口映射，并结合防火墙/安全组验证外部不可访问。API 如需供小程序使用，也应只在 HTTPS 反向代理后公开。后台建议使用 VPN 或 IP 白名单；不要将明文 HTTP 和管理入口直接暴露公网。

## 6. 故障排查

- 端口占用：`lsof -nP -iTCP:8080 -sTCP:LISTEN`，或检查服务器对应端口；修改 `ADMIN_PORT` 后重新执行启动命令。
- 后台 502：查看 `docker compose ps` 和 `docker compose logs --tail=100 web`，确认 API healthy。
- 图片 404：确认迁移完成，检查上传文件卷、图片 URL 和 `/uploads/` 代理；不要清理卷。
- 首次启动失败：检查必填生产配置、MySQL 密码是否与已有数据库一致。日志可能包含敏感信息，分享前先脱敏。
- `npm run build` 失败：查看 `docker compose build admin` 输出；不得用开发服务器替代生产构建。
