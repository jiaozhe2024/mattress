# mattress-ux Docker 部署知识文档

这是一份给前端开发者看的 Docker 部署说明，目标是把本地开发完成的床垫项目部署到阿里云 ECS。

项目包含：

- 管理后台：Vue3 + Vite，最终由 Nginx 提供静态页面
- 后端 API：FastAPI
- 数据库：MySQL
- 缓存：Redis
- 异步任务：当前版本没有后台任务队列或 worker；后续出现真实的耗时后台任务时再单独评估
- 小程序：Uni-app 编译为微信小程序产物，不运行在 ECS 容器里

本文使用的实际环境：

- ECS：Alibaba Cloud Linux 3
- ECS 架构：x86_64
- Docker：26.1.3
- Docker Compose：v2.27.0
- ECS 项目目录：`/opt/projects/mattress-ux`
- 管理后台端口：`18080`
- 已有项目：tarot，占用 3001 端口

重要原则：床垫项目和 tarot 是两个完全独立的项目。不要删除 tarot 的容器、数据卷或目录，也不要使用 tarot 的端口和数据卷。

## 1. 先理解 Docker 是什么

可以把 Docker 理解成“带运行环境的应用盒子”。

普通部署时，服务器需要分别安装：

- Node.js
- Python
- Python 依赖
- MySQL
- Redis
- Nginx
- 各种系统库

Docker 部署时，我们把应用和它需要的运行环境一起封装成镜像。服务器只需要安装 Docker，就可以启动这些镜像。

几个核心概念：

| 概念 | 通俗解释 | 本项目例子 |
|---|---|---|
| 镜像 image | 可以启动容器的安装包/模板 | `backend-admin:latest` |
| 容器 container | 镜像启动后的运行实例 | `mattress-admin-1` |
| Compose | 用一个 YAML 文件管理多个容器 | `docker-compose.yml` |
| 数据卷 volume | 独立于容器的持久化存储 | MySQL 数据、上传图片 |
| 服务 service | Compose 文件里定义的一类容器 | `web`、`admin`、`mysql` |

镜像可以删掉、重建、替换；数据卷里的数据库和上传图片不能随便删。

## 2. 本项目的容器分工

```text
浏览器 / 微信小程序
          |
          v
admin 容器（Nginx，Vue 编译后的静态页面）
          |
          v
web 容器（FastAPI API）
      |             |
      v             v
mysql 容器       redis 容器
```

各服务的作用：

| 服务 | 作用 | 是否保存核心数据 |
|---|---|---|
| `admin` | 提供 Vue 管理后台页面；把 `/api` 和 `/uploads` 转给 `web` | 否 |
| `web` | FastAPI 后端，处理登录、产品、方案、上传等请求 | 业务数据在 MySQL，不在容器本身 |
| `mysql` | 保存后台用户、产品、方案等业务数据 | 是，使用 `mysql_data` 卷 |
| `redis` | 缓存 | 使用 `redis_data` 卷 |

当前 Docker 部署不启动 `worker`。因此 arq 队列中的任务不会被消费，定时审计日志清理等后台任务暂不执行。

## 3. 本项目为什么要用两个 Compose 文件

本地开发使用的 Compose 文件通常包含 `build:`：

```yaml
admin:
  build: ./admin
```

意思是：根据本地源码现场构建镜像。适合开发机，不适合已经没有源码的生产服务器。

ECS 部署使用的 Compose 文件使用 `image:`：

```yaml
admin:
  image: backend-admin:latest
```

意思是：直接使用已经在本地构建好的镜像。ECS 不需要安装 Node，也不需要重新打包 Vue。

当前 ECS 部署用的是单独准备的：

```text
/opt/projects/mattress-ux/docker-compose.yml
```

这份文件不使用 `build:`，而是使用本地导入的镜像。

## 4. 为什么管理后台也在 Docker 里

Vue 项目开发时使用：

```bash
npm run dev
```

这是 Vite 开发服务器，只适合本地开发和热更新。

生产部署时使用：

```bash
npm run build
```

会生成 `dist/` 静态文件。管理后台 Dockerfile 使用多阶段构建：

1. Node 镜像负责执行 `npm ci` 和 `npm run build`。
2. Nginx 镜像只负责提供编译后的 `dist` 文件。
3. 最终运行中的后台容器不需要 Node，也不运行 Vite。

所以生产环境的管理后台结构是：

```text
Vue 源码
  ↓ npm run build
dist/index.html + dist/assets/*
  ↓ 放入 Nginx 镜像
admin 容器
```

## 5. 本地打包镜像

以下命令在本地 Mac 执行，不是在 ECS 执行。

进入后端目录：

```bash
cd /Users/jiaozhe/own/mattress-ux/backend
```

因为 ECS 是 x86_64，所以指定构建为 Linux amd64：

```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build admin web
```

这条命令会构建两个项目镜像：

- `backend-admin:latest`
- `backend-web:latest`

MySQL 和 Redis 使用官方镜像，不需要自己写 Dockerfile。

检查镜像架构：

```bash
docker image inspect backend-admin:latest backend-web:latest mysql:8.0 redis:7-alpine \
  --format '{{.RepoTags}} {{.Os}}/{{.Architecture}}'
```

应该看到：

```text
linux/amd64
```

## 6. 把镜像打包成文件

ECS 如果不能稳定访问 Docker Hub，可以把镜像导出为一个 tar 文件后上传。

```bash
mkdir -p /Users/jiaozhe/own/mattress-ux-deploy

docker save -o /Users/jiaozhe/own/mattress-ux-deploy/mattress-images-amd64.tar \
  backend-admin:latest \
  backend-web:latest \
  mysql:8.0 \
  redis:7-alpine
```

查看文件大小：

```bash
du -h /Users/jiaozhe/own/mattress-ux-deploy/mattress-images-amd64.tar
```

生成校验值：

```bash
shasum -a 256 /Users/jiaozhe/own/mattress-ux-deploy/mattress-images-amd64.tar
```

校验值的作用是确认文件上传过程中没有损坏。上传到 ECS 后，可以再次执行：

```bash
sha256sum /opt/projects/mattress-ux/mattress-images-amd64.tar
```

两边的值应该一致。macOS 使用 `shasum`，Linux 通常使用 `sha256sum`。

## 7. 上传哪些文件到 ECS

当前部署需要上传三个文件：

```text
本地 /Users/jiaozhe/own/mattress-ux-deploy/

├── mattress-images-amd64.tar
├── docker-compose.yml
└── .env.example
```

上传目标目录：

```text
ECS /opt/projects/mattress-ux/
```

上传命令在本地执行：

```bash
scp /Users/jiaozhe/own/mattress-ux-deploy/mattress-images-amd64.tar \
  root@你的ECS公网IP:/opt/projects/mattress-ux/

scp /Users/jiaozhe/own/mattress-ux-deploy/docker-compose.yml \
  root@你的ECS公网IP:/opt/projects/mattress-ux/

scp /Users/jiaozhe/own/mattress-ux-deploy/.env.example \
  root@你的ECS公网IP:/opt/projects/mattress-ux/
```

如果 SSH 使用私钥：

```bash
scp -i ~/.ssh/你的私钥 \
  /Users/jiaozhe/own/mattress-ux-deploy/mattress-images-amd64.tar \
  root@你的ECS公网IP:/opt/projects/mattress-ux/
```

生产配置 `.env` 不从本地上传。原因是本地 `.env` 可能包含开发配置、Mock 开关或密钥。正确做法是在 ECS 上从 `.env.example` 创建 `.env`。

## 8. ECS 导入镜像

SSH 登录 ECS：

```bash
ssh root@你的ECS公网IP
```

进入项目目录：

```bash
cd /opt/projects/mattress-ux
```

检查文件是否存在：

```bash
ls -lh
```

导入镜像：

```bash
docker load -i mattress-images-amd64.tar
```

检查镜像：

```bash
docker image ls | grep -E 'backend-admin|backend-web|mysql|redis'
```

应该看到：

```text
backend-admin
backend-web
mysql
redis
```

`docker load` 只是把镜像放进 ECS 的本地镜像仓库，还没有启动容器。

## 9. 在 ECS 配置生产环境

复制环境变量模板：

```bash
cd /opt/projects/mattress-ux
cp .env.example .env
```

编辑配置：

```bash
vi .env
```

生产环境至少需要配置：

```ini
APP_ENV=production
DEBUG=False
DB_ENGINE=mysql
DB_NAME=mattress
DB_USER=mattress
DB_PASSWORD=数据库用户密码
DB_ROOT_PASSWORD=数据库root密码
SECRET_KEY=随机密钥
WX_JWT_SECRET_KEY=另一组随机密钥
SWAGGER_UI_PASSWORD=Swagger密码
ADMIN_INIT_PASSWORD=后台初始密码
WX_APPID=真实微信AppID
WX_SECRET=真实微信Secret
WX_CODE2SESSION_MOCK=false
CORS_ORIGINS=https://后台域名
STORAGE_DRIVER=local
ADMIN_BIND=127.0.0.1
ADMIN_PORT=18080
```

不要把 `.env` 内容复制到聊天中，也不要提交到 GitHub。

在 ECS 生成两组不同的密钥：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

第一组填 `SECRET_KEY`，第二组填 `WX_JWT_SECRET_KEY`。

`ADMIN_INIT_PASSWORD` 只在数据库中还没有后台用户时用于创建 `admin`。如果数据库已经有用户，修改这个值不会自动修改旧密码。

## 10. 启动服务

启动前先检查 Compose 配置：

```bash
cd /opt/projects/mattress-ux
docker compose config --quiet
```

如果没有输出，通常表示 YAML 和变量配置有效。

查看 Compose 识别到的服务：

```bash
docker compose config --services
```

应该包含：

```text
admin
mysql
redis
web
```

启动时使用 `--no-build`：

```bash
docker compose up -d --no-build
```

`--no-build` 的意思是：只使用已经导入的镜像，不在 ECS 上重新构建。

查看状态：

```bash
docker compose ps
```

成功状态应该是：

- `admin`：Up
- `mysql`：Up，healthy
- `redis`：Up，healthy
- `web`：Up，healthy

当前 Docker 部署不包含 worker；arq 定时任务不会运行。

特别注意：

```text
Created
```

只表示容器被创建了，还没有运行，不算启动成功。如果 admin 是 Created：

```bash
docker compose start admin
docker compose ps -a
docker compose logs --tail=100 admin
```

## 11. 本机验证服务

在 ECS 执行：

```bash
curl -I http://127.0.0.1:18080/
```

预期为：

```text
HTTP/1.1 200 OK
```

验证后端健康接口：

```bash
curl -sS http://127.0.0.1:18080/api/v1/base/health
```

预期返回类似：

```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected"
}
```

如果首页 200、健康接口 200，说明 Nginx、FastAPI、MySQL 和 Redis 的基本链路已经打通。

查看日志：

```bash
docker compose logs --tail=100 admin web mysql redis
```

## 12. 临时开放公网访问

默认配置是：

```ini
ADMIN_BIND=127.0.0.1
ADMIN_PORT=18080
```

这表示只有 ECS 本机能访问，外部浏览器不能直接访问。

如果只是临时测试，可以改成：

```bash
cd /opt/projects/mattress-ux
sed -i 's/^ADMIN_BIND=.*/ADMIN_BIND=0.0.0.0/' .env
docker compose up -d --no-deps --no-build admin
```

确认监听：

```bash
ss -lntp | grep 18080
```

然后在阿里云安全组中放行 TCP 18080。建议授权对象填写自己的公网 IP，例如：

```text
你的办公公网IP/32
```

不建议长期使用：

```text
0.0.0.0/0
```

公网访问地址：

```text
http://你的ECS公网IP:18080
```

这是 HTTP 明文临时方案。正式生产应使用域名 + HTTPS + Nginx 反向代理，且将管理后台重新绑定到 `127.0.0.1`。

## 13. 正式公网访问方案

推荐的正式结构：

```text
浏览器 / 小程序
       |
       | HTTPS
       v
admin.example.com
       |
       v
ECS Nginx :443
       |
       v
127.0.0.1:18080
       |
       v
admin 容器
       |
       v
web 容器
```

正式环境应做到：

- 只开放 ECS 安全组的 80、443
- 不开放 MySQL 3306
- 不开放 Redis 6379
- 不长期开放 18080
- 管理后台使用域名和 HTTPS
- 小程序配置 HTTPS 合法域名
- `CORS_ORIGINS` 使用真实 HTTPS 地址

小程序生产配置示例：

```ini
VITE_API_BASE_URL=https://api.example.com/api/v1
VITE_ASSET_BASE_URL=https://api.example.com
```

注意 API 地址和图片地址不同：

- API 地址需要 `/api/v1`
- 图片资源地址只到域名根路径，不要加 `/api/v1`

例如：

```text
API：   https://api.example.com/api/v1
图片：  https://api.example.com/uploads/xxx.png
```

开发者工具可能允许 HTTP 或不校验合法域名，但手机真机通常要求 HTTPS 和微信公众平台合法域名。开发者工具能显示图片，不代表真机一定能显示。

## 14. 后续只修改管理后台 Vue

本地执行：

```bash
cd /Users/jiaozhe/own/mattress-ux/backend
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build admin

docker save -o /Users/jiaozhe/own/mattress-ux-deploy/admin-update.tar \
  backend-admin:latest
```

上传到 ECS：

```bash
scp /Users/jiaozhe/own/mattress-ux-deploy/admin-update.tar \
  root@你的ECS公网IP:/opt/projects/mattress-ux/
```

ECS 执行：

```bash
cd /opt/projects/mattress-ux
docker load -i admin-update.tar
docker compose up -d --no-deps --no-build admin
```

验证：

```bash
curl -I http://127.0.0.1:18080/
docker compose ps admin
```

只更新 admin，不需要重启 MySQL、Redis、web，也不会影响 tarot。

## 15. 后续修改 FastAPI 后端

本地执行：

```bash
cd /Users/jiaozhe/own/mattress-ux/backend
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build web

docker save -o /Users/jiaozhe/own/mattress-ux-deploy/backend-update.tar \
  backend-web:latest
```

上传：

```bash
scp /Users/jiaozhe/own/mattress-ux-deploy/backend-update.tar \
  root@你的ECS公网IP:/opt/projects/mattress-ux/
```

ECS 执行：

```bash
cd /opt/projects/mattress-ux
docker load -i backend-update.tar
docker compose up -d --no-deps --no-build web
docker compose ps
curl -sS http://127.0.0.1:18080/api/v1/base/health
```

如果修改涉及数据库表结构，不能只替换镜像。需要先备份数据库、确认迁移脚本和回滚方案。

## 16. 后续修改小程序

小程序不运行在 ECS 的 Docker 容器里。

本地修改环境变量后，开发编译：

```bash
cd /Users/jiaozhe/own/mattress-ux/miniprogram
npm run dev:mp-weixin
```

产物目录：

```text
/Users/jiaozhe/own/mattress-ux/miniprogram/dist/dev/mp-weixin
```

微信开发者工具导入这个目录或点击“编译”。

正式发布通常需要：

1. 生成发行版小程序包。
2. 用微信开发者工具上传。
3. 在微信公众平台提交审核。
4. 审核通过后发布。

修改小程序不需要重新构建 ECS 的 admin 或 web 镜像。

## 17. 更新时哪些东西不会丢

正常执行下面的更新命令不会删除数据：

```bash
docker compose up -d --no-build
```

持久化数据在 Docker volumes 中：

- `mysql_data`：MySQL 数据库
- `redis_data`：Redis 数据
- `uploads_data`：后台上传图片

查看卷：

```bash
docker volume ls | grep mattress
```

不要执行：

```bash
docker compose down -v
```

`-v` 会删除 Compose 管理的数据卷，可能导致数据库和上传图片丢失。

普通的：

```bash
docker compose down
```

会停止并删除容器，但通常保留命名卷；生产环境更新前仍然建议先备份。

## 18. 备份建议

备份至少包括：

- MySQL 数据库
- `uploads_data` 上传图片卷
- ECS 上的 `.env`
- 当前使用的镜像版本

查看实际卷名：

```bash
docker volume ls
```

查看容器状态：

```bash
docker compose ps
```

查看资源使用：

```bash
docker system df
```

不要把 `.env`、数据库备份或私钥上传到 GitHub。

## 19. 常见问题

### Q1：后台容器显示 Created

`Created` 代表容器已创建但未运行：

```bash
docker compose start admin
docker compose ps -a
docker compose logs --tail=100 admin
```

### Q2：后台页面 200，但 API 失败

查看 web：

```bash
docker compose ps web
docker compose logs --tail=100 web
curl -sS http://127.0.0.1:18080/api/v1/base/health
```

检查 admin Nginx 是否把 `/api/` 转给 `web:8000`。

### Q3：上传图片成功，但重启后图片消失

通常是没有挂载 `uploads_data` 卷。检查：

```bash
docker inspect mattress-web-1 --format '{{json .Mounts}}'
```

应该看到 `/app/uploads` 对应一个 Docker volume。

### Q4：开发者工具能看图片，手机看不到

常见原因：

- 使用了 HTTP，不是 HTTPS
- 使用 IP 而不是域名
- 使用了微信未配置的域名
- 没有把图片域名加入 `downloadFile` 合法域名
- 真机不允许当前非标准端口

正式解决方式是域名 + HTTPS，并在微信公众平台配置合法域名。

### Q5：更新代码后页面还是旧的

容器不会自动读取本地源码。必须重新构建、导出、上传、导入镜像，并重建对应服务：

```bash
docker compose up -d --no-deps --no-build admin
```

只执行 `docker load` 不会自动替换正在运行的容器。

### Q6：为什么 tarot 没有被影响

因为两个项目隔离：

- tarot 容器名是 `tarot-app-1`、`tarot-db-1`
- tarot 使用 3001 端口
- tarot 使用 `tarot_pgdata` 卷
- mattress 使用自己的 Compose 项目名和卷
- mattress 不使用 3001 端口

检查两个项目：

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker volume ls
```

只在 `/opt/projects/mattress-ux` 目录执行床垫项目的 Compose 命令，不要在 tarot 目录执行。

## 20. 一句话记忆版

本地：

```text
改代码 → build 镜像 → docker save 打包 → scp 上传
```

ECS：

```text
docker load 导入 → docker compose up -d --no-build → docker compose ps 验证
```

数据：

```text
数据库、Redis、上传图片在 volume；不要 docker compose down -v
```

公网：

```text
临时测试可以 IP:18080；正式生产使用域名 + HTTPS
```
