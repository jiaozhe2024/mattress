# 后端部署手册（不使用 Docker）

> 读者：熟悉 PHP / Linux、但**不熟悉 Python** 的运维工程师
> 目标：在一台干净的 Ubuntu / Debian 服务器上，把床垫选品小程序后端跑起来
> 预计耗时：**0.5 – 1 天**（其中大部分时间在等 apt / pip 下载）

---

## 0. 先理解三件事（不用懂 Python 也能懂）

| 概念 | Python 里叫什么 | 类比 PHP |
|---|---|---|
| 代码运行环境 | **虚拟环境（venv）** | 相当于给这个项目单独装一份 PHP，不污染系统 |
| 装依赖 | `pip install` | 相当于 `composer install` |
| 常驻进程 | **uvicorn**（Web 服务）+ **arq**（队列） | 相当于 `php-fpm` + 一个队列消费者（如 supervisor 里的 worker） |

**关键认知：部署不需要写 Python，只需要会敲命令、看日志。**

本项目有两个进程必须同时运行：

| 进程 | 作用 | 少了会怎样 |
|---|---|---|
| `mattress-api` | HTTP 接口，小程序和后台调它 | 全部接口 502 |
| `mattress-worker` | 后台异步任务（分享计数、定时清理日志） | **接口看起来正常**，但异步任务静默不执行 —— 这是最容易漏的坑 |

---

## 1. 服务器要求

| 项 | 最低 | 建议 |
|---|---|---|
| 系统 | Ubuntu 22.04 / Debian 12 | Ubuntu 22.04 LTS |
| CPU | 2 核 | 2 核 |
| 内存 | 2 GB | 4 GB（图片处理吃内存） |
| 磁盘 | 20 GB | 40 GB |
| 已装 | MySQL 8.0、Redis 6+、Nginx | 同 |

**端口**：只需对外开 `80` / `443`。`8000` 只监听 `127.0.0.1`，不对外暴露。

---

## 2. 第一步：准备数据库

```sql
-- 用 root 登录 MySQL 后执行
CREATE DATABASE mattress DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mattress'@'localhost' IDENTIFIED BY '换成强密码';
GRANT ALL PRIVILEGES ON mattress.* TO 'mattress'@'localhost';
FLUSH PRIVILEGES;
```

验证：

```bash
mysql -u mattress -p -e "SHOW DATABASES;" | grep mattress
redis-cli ping      # 应返回 PONG
```

> **表结构不用手工建。** 服务第一次启动时会自动建表并写入基础数据（菜单、角色、字典）。
> 这是本项目刻意设计的，避免运维手工跑 migration 出错。

---

## 3. 第二步：装系统环境

把代码放到 `/opt/mattress-ux`（放别处也行，下文以这个为准）：

```bash
sudo mkdir -p /opt/mattress-ux
sudo rsync -av ./backend/ /opt/mattress-ux/
```

然后一键装环境：

```bash
cd /opt/mattress-ux
sudo bash scripts/deploy/install.sh
```

它做的事：装 Python 3.12、编译工具（`asyncmy` 数据库驱动可能需要现场编译）、nginx、创建不可登录的应用用户 `mattress`。

**看到 `安装阶段完成` 就成功。**

---

## 4. 第三步：配置 .env（最容易出错的一步）

```bash
cd /opt/mattress-ux
sudo cp .env.example .env
sudo chmod 600 .env
sudo nano .env
```

### 必须改的 11 项

生产环境有**强制校验**，任何一项不合规服务直接拒绝启动（这是好事，防止带病上线）。

| 变量 | 必须值 | 说明 |
|---|---|---|
| `APP_ENV` | `production` | 切生产模式 |
| `DEBUG` | `False` | 生产禁止调试 |
| `DB_ENGINE` | `mysql` | 生产强制 MySQL |
| `DB_HOST` / `DB_PORT` / `DB_NAME` | 见上 | 同库同名字段 |
| `DB_USER` / `DB_PASSWORD` | 见上 | 第二步建的账号 |
| `SECRET_KEY` | **≥32 字符随机串** | 后台 JWT 签名密钥 |
| `WX_JWT_SECRET_KEY` | **≥32 字符随机串** | 小程序 JWT 密钥（必须与上一条**不同**） |
| `SWAGGER_UI_USERNAME` / `SWAGGER_UI_PASSWORD` | 自定，密码≥8 位 | 接口文档 `/docs` 的登录密码 |
| `WX_APPID` / `WX_SECRET` | 微信小程序后台拿 | 不填服务起不来 |
| `WX_CODE2SESSION_MOCK` | `false` | **生产必须关掉 mock** |
| `CORS_ORIGINS` | 你的管理后台域名 | **不能含 localhost** |

生成两个密钥（各执行一次，不要用同一个值）：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

正确示例（不要照抄密钥）：

```ini
APP_ENV=production
DEBUG=False
DB_ENGINE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=mattress
DB_PASSWORD=你的数据库密码
DB_NAME=mattress

SECRET_KEY=4f8a...（64位十六进制）
WX_JWT_SECRET_KEY=9c21...（64位十六进制，与上面不同）

SWAGGER_UI_USERNAME=docs
SWAGGER_UI_PASSWORD=你的文档密码

WX_APPID=wx1234567890abcdef
WX_SECRET=你的AppSecret
WX_CODE2SESSION_MOCK=false

CORS_ORIGINS=https://admin.你的域名.com
REDIS_URL=redis://127.0.0.1:6379/0
```

> ⚠️ **`CORS_ORIGINS` 是逗号分隔的普通字符串，不要写 JSON 数组。**
> 正确：`https://a.com` 或 `https://a.com,https://b.com`
> 错误：`["https://a.com"]` —— 会被当成一整串字符串，导致跨域全部失败。

### 关于 `CORS_ORIGINS` 的实测行为

| 写法 | 解析结果 | 是否可用 |
|---|---|---|
| `https://a.com` | `['https://a.com']` | ✅ |
| `https://a.com,https://b.com` | `['https://a.com', 'https://b.com']` | ✅ |
| `["https://a.com"]` | `['["https://a.com"]']` | ❌ 跨域全部失败 |

---

## 5. 第四步：部署

```bash
cd /opt/mattress-ux
sudo bash scripts/deploy/deploy.sh
```

这个脚本依次做：
1. 建虚拟环境 + `pip install`（首次 2–5 分钟）
2. **检查 `.env`** —— 有问题会明确列出哪一项不对，不继续
3. 写 systemd 服务文件并启动
4. **自检** —— 健康检查不通会打印日志并退出非 0

成功时最后输出：

```
  部署成功。
  服务：systemctl status mattress-api mattress-worker
```

### 验证

```bash
curl http://127.0.0.1:8000/api/v1/base/health
```

期望：

```json
{"status":"healthy","database":"connected","redis":"connected"}
```

三种异常及含义：

| 返回 | 原因 |
|---|---|
| `status: healthy` | 一切正常 |
| `status: degraded` + `redis: disconnected` | Redis 没起 或 `REDIS_URL` 写错 |
| `status: degraded` + `database: disconnected` | MySQL 连不上 / 账号密码不对 |

---

## 6. 第五步：配置 Nginx（HTTPS）

```bash
sudo cp scripts/deploy/nginx.conf.example /etc/nginx/sites-available/mattress-ux
sudo nano /etc/nginx/sites-available/mattress-ux   # 把 api.example.com 换成你的域名
sudo ln -s /etc/nginx/sites-available/mattress-ux /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

签证书（免费，自动续期）：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.你的域名.com
```

> 微信小程序要求接口域名必须是 **HTTPS + 已备案 + 在微信后台配置过**。
> 这三条缺一个，小程序端都会报「网络错误」，且报错信息不会告诉你原因。

---

## 7. 日常运维命令

```bash
# 看服务状态
systemctl status mattress-api mattress-worker

# 看实时日志（最常用）
journalctl -u mattress-api -f
journalctl -u mattress-worker -f

# 重启（改完 .env 必须重启 API + worker）
systemctl restart mattress-api mattress-worker

# 改代码后更新（--no-deps 跳过重装依赖，快）
sudo bash scripts/deploy/deploy.sh --no-deps
```

---

## 8. 常见报错对照表

| 报错 / 现象 | 原因 | 解决 |
|---|---|---|
| `ValueError: 生产环境不能启用DEBUG模式` | `DEBUG=True` | 改 `False` |
| `生产环境必须关闭 WX_CODE2SESSION_MOCK` | 忘了关 mock 登录 | 改 `false` |
| `生产环境必须通过 env 覆盖 WX_JWT_SECRET_KEY` | 还在用默认密钥 | 覆盖成随机 32 位以上 |
| `SWAGGER_UI_PASSWORD必须设置` | 漏填接口文档密码 | 填，且 ≥8 位 |
| `SECRET_KEY长度至少32字符` | 密钥太短 | `openssl rand -hex 32` |
| `TypeError: _read_file() takes 2 positional...` | 已修复（本次部署改造） | 确认代码是最新的 |
| 接口全 502 | API 进程没起 | `journalctl -u mattress-api -n 50` |
| `status: degraded`, redis disconnected | Redis 没起 | `systemctl start redis-server` |
| 小程序报「网络错误」 | 域名没备案 / 没配 HTTPS / 没在微信后台加白名单 | 逐项核对 |
| 图片上传 413 | Nginx `client_max_body_size` 太小 | 改成 `20m` |

---

## 9. 本次部署改造顺带修复的 Bug

部署到裸机时才暴露、Docker 里看不到的问题：

### `AdaptiveEnvConfig._read_file` 参数签名不兼容

`src/api/v1/base/base.py` 里为了兼容 Windows 中文编码，自定义了 `_read_file`，
但签名是 `(self, file_name)`；而 starlette ≥1.10 调用时会传 `(file_name, encoding)`。

**后果**：只要**当前工作目录下存在 `.env`**，服务启动立即崩溃：

```
TypeError: _read_file() takes 2 positional arguments but 3 were given
```

**为什么以前没发现**：Docker 镜像里不拷贝 `.env`（配置靠环境变量注入），
`os.path.isfile(".env")` 恒为 `False`，这条路径从未被触发。
而裸机部署 `.env` 必然在项目根目录 —— **Docker 跑得通，裸机必崩**。

**已修**：签名改为 `(self, file_name, encoding=None)`，两种调用约定都兼容。

---

## 10. 给运维的一句话总结

```bash
# 首次
sudo bash scripts/deploy/install.sh
sudo cp .env.example .env && sudo nano .env      # 改 11 项
sudo bash scripts/deploy/deploy.sh

# 以后更新代码
sudo bash scripts/deploy/deploy.sh --no-deps
```

不需要懂 Python。出了问题看 `journalctl -u mattress-api -f`，
把最后 50 行发给开发即可。
