# 管理后台部署手册（不使用 Docker）

> 读者：熟悉 PHP / Linux、不熟悉 Node.js 的运维工程师
> 目标：把 Vue3 管理后台发布到 Nginx
> 预计耗时：**20 – 40 分钟**

---

## 0. 先理解一件事：后台是「纯静态站点」

后台（`backend/admin/`）是 **Vue3 + Vite** 构建的**纯前端静态站点**，
构建产物就是一堆 `.html` / `.js` / `.css` 文件。

| | 后端 API | 管理后台 |
|---|---|---|
| 运行方式 | Python 常驻进程（uvicorn） | **Nginx 发静态文件，没有进程** |
| 需要什么 | Python + venv + systemd | **只需要 Nginx** |
| 类比 PHP | 类似 php-fpm | **类似纯 HTML 站点** |

**关键结论：生产服务器不需要装 Node.js。**
Node 只在**构建机**（可以就是你的开发机）上用来编译前端，编译完把 `dist/` 拷到服务器即可。

```
构建机（有 Node）           服务器（只需 Nginx）
npm run build      ──►      /var/www/mattress-admin/
   → dist/                        index.html + assets/
```

---

## 1. 前置条件

| 项 | 要求 |
|---|---|
| 后端 API | **已部署并可用**（见 `docs/DEPLOY-NO-DOCKER.md`） |
| 构建机 Node | **18+，推荐 20 LTS** |
| 服务器 | Nginx 已安装（`install.sh` 已装） |
| 域名 | 一个独立域名，如 `admin.你的域名.com` |

> 后台与后端**建议用两个不同域名**（`admin.xxx.com` 与 `api.xxx.com`）。
> 虽然本文档的配置也让二者同源可用，但分开更利于单独做访问限制。

---

## 2. 第一步：确认后端地址

后台生产配置（`backend/admin/.env.production`）用的是**相对路径**：

```ini
VITE_API_BASE_URL=/api/v1
```

意思是「浏览器向**后台自己的域名**发 `/api/v1/...` 请求」，再由 Nginx 转发给后端。

**这样做的好处**：前端不需要知道后端域名，也不存在跨域问题。

**所以 Nginx 必须同时做两件事**：发静态文件 + 把 `/api/` 和 `/uploads/` 转发给后端。
配置见下一步，已经写好，不用你手写。

---

## 3. 第二步：构建（在构建机上）

```bash
cd /path/to/mattress-ux/backend
bash scripts/deploy/build-admin.sh
```

脚本做三件事：
1. 检查 Node 版本（低于 18 直接报错退出）
2. `npm ci` 装依赖（用 lockfile 保证版本一致）
3. `npm run build` —— 内部是 `vue-tsc --noEmit && vite build`，**类型检查不过会直接失败**

成功输出：

```
  ✓ 构建完成，产物大小：2.5M
产物位置：.../backend/admin/dist
```

### 直接在构建机上发布（可选）

如果构建机就是服务器，一条命令搞定：

```bash
sudo bash scripts/deploy/build-admin.sh --deploy
```

它会把 `dist/` 同步到 `/var/www/mattress-admin/`，并把旧版本备份到 `.bak`（便于回滚）。

### 构建机与服务器分离时

```bash
# 构建机
cd backend/admin && npm run build

# 传到服务器（rsync 会只传变化的文件）
rsync -avz --delete backend/admin/dist/ user@server:/tmp/mattress-admin-dist/

# 服务器
sudo rsync -a --delete /tmp/mattress-admin-dist/ /var/www/mattress-admin/
sudo chown -R www-data:www-data /var/www/mattress-admin
```

> ⚠️ 必须用 `rsync --delete`。Vite 产物文件名带内容 hash
> （`index-eq8TfEXc.js`），每次构建文件名都变。不加 `--delete` 旧文件会一直堆积。

---

## 4. 第三步：配置 Nginx

```bash
sudo cp scripts/deploy/nginx-admin.conf.example /etc/nginx/sites-available/mattress-admin
sudo nano /etc/nginx/sites-available/mattress-admin    # 把 admin.example.com 改成你的域名
sudo ln -s /etc/nginx/sites-available/mattress-admin /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 配置里三块关键逻辑（已写好，这里解释为什么）

**① 前端路由 fallback（缺了必出 404）**

后台路由用 `createWebHistory()`（HTML5 history 模式）。访问 `/data/wx-user` 时，
服务器上**并没有**这个文件 —— 必须回退到 `index.html` 交给前端路由处理：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

没有这行，用户**刷新任何内页都会 404**（点进去能用，一刷新就挂，很难排查）。

**② 静态资源强缓存，index.html 不缓存**

```nginx
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate" always;
}
```

- `assets/` 文件名带 hash，内容变了文件名就变 → 可以缓存一年
- `index.html` 是入口，**绝不能缓存**，否则发版后用户还在加载旧版本

**③ 接口同源反代**

```nginx
location /api/     { proxy_pass http://127.0.0.1:8000; }
location /uploads/ { proxy_pass http://127.0.0.1:8000; }
```

不配这个，后台登录会一直转圈（`/api/v1/base/access_token` 404）。

---

## 5. 第四步：HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d admin.你的域名.com
```

---

## 6. 第五步：安全加固（重要，别跳过）

管理后台是**敏感入口**（能改产品、删方案、看用户数据），不能像官网一样裸奔。

### 方式 A：IP 白名单（推荐，简单有效）

```nginx
location / {
    allow 203.0.113.0/24;    # 公司出口 IP
    allow 198.51.100.7;      # 运维家宽
    deny all;
    try_files $uri $uri/ /index.html;
}
```

### 方式 B：HTTP Basic 再套一层

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd adminuser
```

```nginx
location / {
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri/ /index.html;
}
```

> 两种可以叠加。**至少选一种** —— 后台的登录页本身也是攻击面。

### 另外两件事

1. **首次登录后立刻改管理员密码**

   服务首次启动时若库里没有任何后台用户，会自动创建超级管理员：

   | 项 | 值 |
   |---|---|
   | 账号 | `admin` |
   | 密码 | `.env` 的 `ADMIN_INIT_PASSWORD`；**未设置时为 `abcd1234`** |
   | 邮箱 | `admin@admin.com` |

   **正确做法：部署前就在 `.env` 里设置**

   ```bash
   # 生成一个强口令
   openssl rand -base64 18
   # 写进 .env
   ADMIN_INIT_PASSWORD=刚生成的口令
   ```

   > ⚠️ 历史问题（已修）：原代码把密码硬编码为 `abcd1234`，且日志会打印
   > `用户名: admin / 密码: abcd1234` 明文。现已改为读 `ADMIN_INIT_PASSWORD`，
   > 日志不再输出密码；未配置时会打 WARNING（不会静默用弱口令）。
   > `deploy.sh` 会在 `.env` 未设置该项时给黄色警告。
   >
   > **注意**：该变量只在「库里没有任何后台用户」时生效。库已初始化过，
   > 改这个变量不会改变现有密码 —— 需登录后台改密，或手工重置。

2. **`/docs` 接口文档不要对公网开放**（`nginx-admin.conf.example` 里那段可以删掉）

---

## 7. 验证清单（部署完逐项打勾）

| # | 检查项 | 命令 / 操作 | 期望 |
|---|---|---|---|
| 1 | 首页可访问 | 浏览器打开 `https://admin.你的域名.com` | 看到登录页 |
| 2 | **深层路由刷新不 404** | 登录后进「数据 → 小程序用户」，按 F5 | 页面正常，不 404 |
| 3 | 登录能通 | 输入账号密码 | 进入后台，不转圈 |
| 4 | 列表能加载 | 「产品管理」页 | 有数据 |
| 5 | 图片能显示 | 产品列表看缩略图 | 图片正常 |
| 6 | 上传能通 | 产品编辑 → 上传图片 | 上传成功并回显 |
| 7 | 静态资源缓存 | F12 → Network 看 js | `Cache-Control: public, max-age=31536000` |
| 8 | 入口不缓存 | F12 → Network 看 index.html | `no-store` |

**第 2 项和第 3 项是最容易出问题的**，分别对应 Nginx 的 fallback 和 `/api` 反代。

---

## 8. 日常更新（发新版）

```bash
# 构建机
cd backend
bash scripts/deploy/build-admin.sh

# 服务器（或在构建机上直接 --deploy）
sudo rsync -a --delete backend/admin/dist/ /var/www/mattress-admin/
sudo systemctl reload nginx    # 通常不需要，静态文件即时生效
```

> 用户如果还看到旧页面，让他 **Ctrl+F5 强制刷新**。
> 因为 `index.html` 设了不缓存，正常刷新就该拿到新版；如果仍是旧的，说明缓存配置没生效。

### 回滚

```bash
sudo rm -rf /var/www/mattress-admin
sudo mv /var/www/mattress-admin.bak /var/www/mattress-admin
```

（`build-admin.sh --deploy` 每次发布前会自动备份上一版）

---

## 9. 常见问题对照表

| 现象 | 原因 | 解决 |
|---|---|---|
| 打开是白屏，F12 报 `Failed to load module script` | 静态资源 404 | 检查 `root` 路径是否指向 `dist` 内容（不是 `dist` 目录本身） |
| **点进内页正常，一刷新 404** | 缺 `try_files ... /index.html` | 补 SPA fallback |
| 登录一直转圈 / 提示网络错误 | `/api` 没反代，或后端没起 | `curl http://127.0.0.1:8000/api/v1/wxapi/brand` |
| 图片全裂 | `/uploads/` 没反代 | 补 `/uploads/` location |
| 发版后仍是旧页面 | `index.html` 被缓存 | 确认 `index.html` 返回 `no-store` |
| 构建失败 `vue-tsc` 报错 | 类型错误 | 这是**故意的**，让开发修完再发 |
| `npm ci` 报 lockfile 不一致 | `package-lock.json` 与 `package.json` 不同步 | 用 `npm install` 重新生成 lock 后提交 |
| Nginx 502 | 后端没起 | `systemctl status mattress-api` |

---

## 10. 给运维的一句话总结

```bash
# 构建（构建机，需要 Node）
bash scripts/deploy/build-admin.sh

# 发布（服务器，只需 Nginx）
sudo rsync -a --delete backend/admin/dist/ /var/www/mattress-admin/

# 首次部署额外做一次 Nginx 配置
sudo cp scripts/deploy/nginx-admin.conf.example /etc/nginx/sites-available/mattress-admin
# 改域名 → 软链 → nginx -t → reload
```

**不需要懂 Node.js，也不需要懂 Vue。**
出问题先看 `sudo tail -50 /var/log/nginx/mattress-admin.error.log`。

---

## 附：本手册配置的实测记录

以下结果来自实际用 Nginx 容器跑通验证，不是纸面推演：

| 验证项 | 结果 |
|---|---|
| `nginx -t` 配置语法 | ✅ successful |
| `/` 首页 | ✅ 200 text/html |
| `/login`、`/data/wx-user`、`/data/scheme`、`/product/list` 深层路由 | ✅ 全部 200（SPA fallback 生效） |
| `/assets/index-xxx.js` | ✅ 200，`Cache-Control: public, max-age=31536000, immutable` |
| `/index.html` | ✅ 200，`Cache-Control: no-store, no-cache, must-revalidate`（单条，无重复头） |
| `/api/v1/wxapi/brand` 反代 | ✅ 200，返回真实业务数据 |
| `/assets/nope.js`（不存在） | ✅ 404（不会错误回退到 index.html） |
