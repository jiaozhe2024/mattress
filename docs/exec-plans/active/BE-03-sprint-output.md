# BE-03 Sprint Output — Admin 前端工程骨架（Vue3 + Element Plus）

- 日期：2026-11-05
- 执行人：CC
- 状态：submitted（待 Hermes/Evaluator 复跑验收）
- 范围：仅骨架（登录页 / 布局框架 / 路由守卫 / RBAC 菜单级过滤 / axios 封装）。业务 CRUD 页面属 BE-08/BE-09，未实现。backend/src 未做任何修改。

## 1. 交付内容

新建 `backend/admin/`（Vite + Vue3 + TS + Element Plus，无模板 vendor 代码，全部 CC 生成）：

| 文件 | 职责 |
|------|------|
| `package.json` / `vite.config.ts` / `tsconfig.json` / `index.html` / `.env.*` | 工程配置；dev 端口固定 **8080**（后端 CORS 白名单仅 localhost:3000/8080，3000 被本机 open-webui 占用） |
| `src/api/request.ts` | axios 封装：baseURL=`VITE_API_BASE_URL`（dev 默认 `http://localhost:8000/api/v1`）、Bearer 注入、信封拆包、统一 ElMessage 错误 toast、**401 → 清 token 整页跳 /login** |
| `src/api/auth.ts` | `POST /base/access_token`、`GET /base/userinfo`、`GET /role/authorized?id=` |
| `src/stores/auth.ts` | Pinia setup store：token / userInfo / `allowedMenuPaths`（超管=`'all'`，普通用户=各角色菜单 path 并集）；login / loadUserInfo / logout |
| `src/router/routes.ts` + `index.ts` | 静态路由表（Login / Layout+Dashboard / 404）；全局守卫：无 token→/login（带 redirect 回跳，redirect 仅接受站内绝对路径防开放重定向）；/login 已登录→回首页；首次进入拉 userinfo（失败→登出回登录页）；meta.rbacPath 不在权限集合→回 /dashboard |
| `src/utils/menu.ts` | 菜单级 RBAC：后端菜单 path 归一化（子菜单相对片段拼父路径）+ 路由树过滤（不改原树，返回新树）+ 单路由准入判断 |
| `src/utils/storage.ts` | token localStorage 存取（骨架版明文，见风险 6） |
| `src/layout/index.vue` + `components/SideMenu.vue` + `components/NavBar.vue` | 布局框架：深色侧边菜单（RBAC 过滤后渲染，el-menu router 模式）+ 顶栏（面包屑取自 matched meta.title + 用户下拉退出） |
| `src/views/login/index.vue` | 登录页：el-form 校验、回车提交、loading、登录成功后拉 userinfo 再回跳 |
| `src/views/dashboard/index.vue` | 工作台占位页（展示用户名/角色/超管标记/最后登录） |
| `src/views/error/404.vue` | 404 页 |

后端契约核验结论（只消费，未改后端）：

- 登录：`POST /api/v1/base/access_token`，body `{username,password}`，成功信封
  `{"code":200,"msg":"OK","data":{"access_token","refresh_token","username","token_type":"bearer","expires_in":14400}}`
- 错误密码：HTTP **400** `{"code":400,"msg":"密码错误!","data":null}`（base.py 的 authenticate 抛 HTTPException(400)，非 401）
- 用户信息：`GET /api/v1/base/userinfo`（Bearer）→ 含 `is_superuser`、`roles[]`（浅序列化，不含菜单）
- RBAC 菜单数据源：`GET /api/v1/role/authorized?id=<role_id>` → `Role.to_dict(m2m=True)` 含该角色 `menus[]/apis[]`
- 无效/过期 token：`GET /base/userinfo` 返回 HTTP 401（触发前端清 token 跳登录）

## 2. Verify 复跑（Hermes 用）

前置：`docker compose up -d`（backend/）且 `curl http://localhost:8000/api/v1/base/health` 为 healthy；登录接口限流 5 次/分钟，脚本内共 2 次登录尝试。

```bash
cd backend/admin
npm install          # 已验 node v24.16.0 / npm 11.13.0
npm run build        # ① vue-tsc --noEmit ② vite build
npm run dev          # 起 dev server（http://localhost:8080，CORS 需要）
# 浏览器验收脚本（python playwright，chromium）：内容见文末附录 A
python3 /tmp/be03_verify.py   # 或按附录 A 重建该脚本
curl -s -X POST http://localhost:8000/api/v1/base/access_token -H 'Content-Type: application/json' -d '{"username":"admin","password":"wrongpass"}' -w '\nHTTP:%{http_code}\n'
```

实际输出（2026-11-05 本机）：

```
> mattress-admin@0.1.0 build
> vue-tsc --noEmit && vite build
vite v6.4.5 building for production...
✓ 1700 modules transformed.
dist/index.html   0.41 kB │ gzip: 0.31 kB
... (省略 chunk 明细，含 1 个 >500kB chunk 警告，见风险 7)
✓ built in 13.58s

GET /login -> 200
GET / -> 200

[PASS] no-token redirect to /login url=http://localhost:8080/login?redirect=/dashboard
[PASS] wrong password shows error toast toast='密码错误!'
[PASS] wrong password stays on /login url=http://localhost:8080/login?redirect=/dashboard
[PASS] login success -> /dashboard url=http://localhost:8080/dashboard
[PASS] sidebar menu rendered
[PASS] sidebar has 工作台
[PASS] topbar shows username admin
[PASS] breadcrumb rendered crumb='工作台'
[PASS] invalid token redirects to /login url=http://localhost:8080/login?redirect=%2Fdashboard
[PASS] invalid token clears token
RESULT: ALL PASS

{"code":400,"msg":"密码错误!","data":null}
HTTP:400
```

截图：/tmp/be03_dashboard.png（布局：侧边菜单+顶栏面包屑+admin 下拉+工作台卡片）、/tmp/be03_login.png（登录页）。

## 3. API 契约缺口（不改后端，仅记录）

1. **`/base/usermenu` 聚合接口被模板注释未启用**（backend/src/api/v1/base/base.py L196-221）。前端只能：超管全放行；普通用户按角色逐个 `GET /role/authorized` 求菜单并集。若自定义角色未绑定 `GET /api/v1/role/authorized` 这条 API，会 403 → 前端降级为空菜单集合（仅 alwaysAllow 项可见），不阻塞登录。建议后续任务在后端恢复/新增 usermenu 聚合端点。
2. **错误密码返回 HTTP 400 而非 401/422**（repositories/user.py authenticate）。前端按信封 msg 提示，行为正确，但语义非常规，后续接验证码/锁定策略时注意。
3. **后端种子菜单与前端路由不对应**：基座 init_menus 种子是模板菜单（/system/*、/top-menu），本骨架前端无对应页面。RBAC 过滤只作用于声明了 `meta.rbacPath` 的前端路由；BE-08/BE-09 建业务页时须同步在后端菜单表登记 path 并给路由声明 rbacPath，过滤才会对业务菜单生效。
4. 登录限流 **5 次/分钟**（slowapi，base.py apply_rate_limit），自动化验收与连续输错密码会被限流 429；前端未做限流退避重试（骨架可接受）。
5. refresh_token 端点存在但**骨架未实现自动续签**：access 过期（4h）后任意请求 401 → 清 token 回登录页。自动续签留作后续增强。

## 4. 遗留风险

1. token 存 localStorage 明文（XSS 可窃）。替代方案 httpOnly Cookie 需后端改造（跨域+CSRF），留技术债，BE-08 前评估。
2. 401 处理用 `window.location` 整页跳转（避免 request↔router 循环依赖），体验上有整页刷新；后续可改事件总线。
3. Element Plus 全量引入 → 生产包 1.28MB（gzip 414KB）有 chunk 警告。BE-08 引入 unplugin-auto-import/unplugin-vue-components 按需加载。
4. CORS 白名单写死后端 config（localhost:3000/8080），换端口 dev 会跨域失败；已在 vite.config 注释说明。
5. 面包屑取 matched meta.title，Layout 根无 title，故仅显示叶子标题；BE-08 多级目录时补 meta.title 即可。
6. Playwright 验证脚本未入库（/tmp 临时件，附录 A 保留全文供复跑）；admin 为 Web 端，miniprogram-automator 的 scripts/e2e 约定不适用。

## 5. 自我批判 / 边界

- 确定可行：登录/守卫/RBAC 过滤/布局均已浏览器实测；构建与类型检查全绿。
- 经验推断：`role/authorized` 作为普通用户菜单数据源依赖「角色绑定了该 GET API」这一种子行为（init_roles 给普通用户绑了全部 GET API），自定义角色需管理员手工补 API 权限。
- 不适用边界：本骨架不含任何业务 CRUD、文件上传、wangEditor；生产部署需自行配反代与 `VITE_API_BASE_URL`。

## 附录 A：浏览器验收脚本（python playwright）

```python
"""BE-03 admin skeleton browser verification (Playwright, chromium)."""
import sys
from playwright.sync_api import expect, sync_playwright

BASE = "http://localhost:8080"
OK = []

def check(name, cond, detail=""):
    OK.append(cond)
    print(f"[{'PASS' if cond else 'FAIL'}] {name} {detail}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto(BASE + "/dashboard", wait_until="networkidle")
    page.wait_for_timeout(800)
    check("no-token redirect to /login", "/login" in page.url, f"url={page.url}")

    page.fill('input[placeholder="用户名"]', "admin")
    page.fill('input[placeholder="密码"]', "wrong-password")
    page.click('button:has-text("登录")')
    toast = page.locator(".el-message--error")
    toast.first.wait_for(state="visible", timeout=8000)
    text = toast.first.inner_text()
    check("wrong password shows error toast", "密码错误" in text, f"toast={text!r}")
    check("wrong password stays on /login", "/login" in page.url, f"url={page.url}")

    page.fill('input[placeholder="用户名"]', "admin")
    page.fill('input[placeholder="密码"]', "abcd1234")
    page.click('button:has-text("登录")')
    page.wait_for_url(BASE + "/dashboard", timeout=10000)
    page.wait_for_timeout(800)
    check("login success -> /dashboard", page.url.endswith("/dashboard"), f"url={page.url}")
    check("sidebar menu rendered", page.locator(".el-menu").count() > 0)
    check("sidebar has 工作台", page.locator(".el-menu-item:has-text('工作台')").count() > 0)
    check("topbar shows username admin", page.locator(".username").inner_text().strip() == "admin")
    check("breadcrumb rendered", "工作台" in page.locator(".el-breadcrumb").inner_text())
    page.screenshot(path="/tmp/be03_dashboard.png")

    page.evaluate("localStorage.setItem('mattress_admin_access_token','invalid.jwt.token')")
    page.goto(BASE + "/dashboard", wait_until="networkidle")
    page.wait_for_timeout(1200)
    check("invalid token redirects to /login", "/login" in page.url, f"url={page.url}")
    check("invalid token clears token",
          page.evaluate("localStorage.getItem('mattress_admin_access_token')") in (None, ""))
    browser.close()

print("RESULT:", "ALL PASS" if all(OK) else "SOME FAIL")
sys.exit(0 if all(OK) else 1)
```
