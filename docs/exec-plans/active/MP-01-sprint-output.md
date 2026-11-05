# MP-01 Sprint Output — 小程序骨架（Uni-app + Vue3 + TS + Pinia，V2.0 三 Tab）

> 状态：submitted（待 Hermes 复跑验收，未自评 done）
> 日期：2026-11-05

## 1. 改了什么

| 项 | 内容 |
|----|------|
| 工程初始化 | `npx degit dcloudio/uni-preset-vue#vite-ts miniprogram`（官方 vite-ts 模板，uni-app 编译器 5.34 / vue3），产物可被微信开发者工具打开（`dist/build/mp-weixin`、`dist/dev/mp-weixin` 均已产出 `project.config.json`） |
| 状态管理 | 新增 `src/stores/useSelectionStore.ts`（Pinia）：`selectedProducts` + `currentSchemeId`，actions `addProduct`（按 id 去重）/`removeProduct`/`clearSelection`，getter `selectedCount`（按 aaa.md §3.3.1 实现，全部用不可变更新） |
| 请求封装 | `src/utils/request.ts`：baseURL 取 `import.meta.env.VITE_API_BASE_URL`（.env.development/.env.production 配置）；自动注入 `Authorization: Bearer <token>`；统一错误 toast（`silent` 可关）；HTTP 401 或业务码 401 时清 token → 静默重登一次 → 自动重试请求（防循环）。参考 小兔鲜儿 的实现思路，代码为自写（见 License 检查） |
| 静默登录 | `src/utils/auth.ts` + `src/utils/token.ts`：`wx.login` → `POST /wxapi/auth/login {code}` → `uni.setStorageSync('token', ...)`；dev/自动化环境 mock（`VITE_USE_WX_MOCK=true` 时用固定测试 code，不调真实 wx.login），后端 code2session 由 BE-04 dev-mock 对固定 openid（AGENTS.md 约定 4）。App.onLaunch 发起，失败静默 |
| 三 Tab | `src/pages.json` tabBar 恰好 3 项：首页(`pages/index/index`)/产品(`pages/product/list`)/我的(`pages/user/index`)（aaa.md §3.1.1），占位内容 + 全局悬浮选款按钮（仅 index 页 present） |
| 悬浮按钮 | `src/components/SelectFab.vue`：主程序 `app.component('SelectFab', ...)` 全局注册；直径 56rpx 圆形、背景 `#D4A574`、文字「选款」；右上角角标实时显示 `selectedCount`（>99 显示 99+）；点击跳 `/pages/scheme/selection`（页面由 MP-03/MP-05 落地，暂 fallback toast）。编译产物 `usingComponents` 已确认注入 |
| 单测 | vitest：`tests/useSelectionStore.test.ts`（去重/移除/清空/计数）、`tests/request.test.ts`（baseURL、token 注入、401 重登重试、500 不重试、silent 关 toast、网络失败）、`tests/auth.test.ts`（mock code → /wxapi/auth/login → 落 token） |
| E2E | `scripts/e2e/skeleton.auto.js`（miniprogram-automator）：断言 tabBar 3 项 + 三 tab 切换 + 首页 `.select-fab` 存在 + 每 tab 截图到 `docs/exec-plans/screenshots/`。**运行时链路被 DevTools 未登录阻塞（见 §5）**，脚本静态断言部分已在本机通过 |
| 工程规范 | `miniprogram/.gitignore` 忽略 node_modules/dist；根 `.gitignore` 追加 `docs/exec-plans/screenshots/`；manifest.json 使用 `touristappid`（未注册 AppID 时开发者工具可打开） |

## 2. 参考项目 License 检查（AGENTS.md 约定 11 红线）

| 项 | 结果 |
|----|------|
| 仓库 | `Megasu/uniapp-shop-vue3-ts`（uni-app 开发的微信小程序-小兔鲜儿电商项目） |
| LICENSE | **Apache License 2.0**（master 分支，`https://api.github.com/repos/Megasu/uniapp-shop-vue3-ts/license` 返回 Apache-2.0） |
| 结论 | 允许复制文件（需保留授权声明）。**本次未复制任何文件**，仅参考其请求封装/商品卡片实现思路，全部代码自写（`src/utils/request.ts` / 商品模型等），规避附加授权与版权归属负担。记录以备验收 |

## 3. 验证命令与实际输出

```bash
cd miniprogram

# ① 依赖安装（node v24.16.0 / npm 11.13.0）
npm install            # 退出码 0（32s 内完成，@dcloudio/* 3.0.0-5030420261029002 等安装齐全）

# ② 生产构建（0 报错）
npm run build:mp-weixin
# → DONE  Build complete.  运行方式：打开 微信开发者工具, 导入 dist/build/mp-weixin 运行。

# ③ dev 构建（watch 模式，已产出 dist/dev/mp-weixin）
npm run dev:mp-weixin
# →（后台任务）dist/dev/mp-weixin/{app.js,app.json,app.wxss,pages/{index,product,user},components/...} 齐

# ④ 编译产物 tabBar 配置核对（build app.json）
# → "tabBar": { "list": [{首页},{产品},{我的}] } 共 3 项；"usingComponents": {"select-fab": "/components/SelectFab"}

# ⑤ 单元测试（16/16 通过，覆盖 store + request + auth）
npm test
# → Test Files  3 passed (3)   Tests  16 passed (16)

# ⑥ 类型检查
npx vue-tsc --noEmit   # → 退出码 0，无类型错误
```

## 4. E2E 脚本实际运行情况

```bash
node ../scripts/e2e/skeleton.auto.js            # 工作目录 miniprogram/
# [1/3] tabBar 配置断言通过：首页 / 产品 / 我的
# [断言失败] Wait timed out after 30000 ms        # automator.launch 连不上自动化端口
```

开发者工具登录状态：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli islogin` → `{"login":false}`。

## 5. 阻塞项（Blocked Verification）

- **DevTools 未登录**：`cli islogin` 输出 `{"login":false}`。miniprogram-automator 依赖登录态 + 「设置-安全设置-服务端口」开启，两者未就绪导致运行时自动化超时。`cli open --project …` 可正常打开工程（✔ open），说明构建产物可打开性无问题。
- 待 Hermes 复跑前需人工在微信开发者工具扫码登录并开启服务端口，然后 `node scripts/e2e/skeleton.auto.js` 即可得 3 张 tab 截图 + 切换断言。
- 脚本已交付且静态断言（tabBar 3 项）本机已通过，运行时部分为阻塞项，不是实现缺陷。

## 6. 踩坑记录

1. **装饰器/编译器无关**：模板自带 lint 无；类型检查发现的 `RequestConfig extends UniApp.RequestOptions` 要求必填 `url`，导致 `post(url, data, {silent:true})` 不合法——改为 `extends Partial<UniApp.RequestOptions>` + 内部 `request()` 限定 `{url; method}` 后 `vue-tsc` 清零。
2. **业务码 401（HTTP 200）不触发重登的坑**：初版按 HTTP statusCode 判断 401，后端信封 `code:401` 时不会重登；rawRequest 已改为「HTTP 非 200 用 HTTP 码，HTTP 200 用业务码」，并加单测覆盖两种 401。
3. **E2E 依赖解析**：automator 装在 `miniprogram/node_modules`，根脚本用 `createRequire(miniprogram/package.json)` 解析，避免在仓库根建 node_modules。

## 7. 残留风险与后续动作

- **悬浮按钮规格异常**：aaa.md §3.1.2 直径写 56rpx（约 28px），两字「选款」+ 角标在圆内空间极其局促，疑似规格笔误（常见为 96~120rpx）。本任务按规格字面实现为 56rpx，**待 Designer/Hermes 确认后 MP-02/MP-03 再调**。
- **baseURL 占位**：生产域名 `.env.production` 为 `https://api.example.com` 占位，部署时替换；后端 NG-01 未起，dev 下启动时静默登录会失败（App 已 catch 静默，不影响骨架）。
- **touristappid**：可打开工程但真实小程序请求受限，正式联调/真机需换成注册的 AppID。
- **Pinia 无持久化**：V2.0 目前不落盘已选产品（多清单方案编辑页 MP-05 再定是否需要会话内持久化）。
- 后端 `backend/`、`jp/`、`部署.md` 等与本次任务无关的工作区改动未提交。

## 8. 本地复跑入口

```bash
# 1) 打开小程序
/Applications/wechatwebdevtools.app/Contents/MacOS/cli open --project miniprogram/dist/dev/mp-weixin
# 2) DevTools 扫码登录 + 开启「设置-安全设置-服务端口」
# 3) 单测
cd miniprogram && npm test
# 4) 自动化验收（登录态就绪后）
node scripts/e2e/skeleton.auto.js
```