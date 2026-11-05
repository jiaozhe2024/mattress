# MP-02 Sprint Output — 小程序首页（Banner/7 分类宫格/品牌服务/辅助入口）

- 任务：MP-02（tasks.json，priority=high，blocked_by=用户确认设计稿 + MP-01 + BE-05，均已满足；jp/首页.jpg 已就绪）
- 执行：CC 1 会话（撞 60 轮上限退出，代码已完整提交 8ab9400；sprint_output 由 Hermes 补写）
- 状态：submitted（待 Hermes 验收，本文件即复跑记录）

## 1. 交付内容（commit 8ab9400）

| 文件 | 说明 |
|------|------|
| miniprogram/src/pages/index/index.vue | 首页主体（580 行增改）：banner 轮播(jump_type 1~4 分发) + 7 分类宫格 + 品牌服务横滚 + 资讯/客服入口 + 悬浮选款常驻 |
| miniprogram/src/pages/article/list.vue | 资讯列表页（jump 目标，CC 越界补建，避免首页跳转死链） |
| miniprogram/src/pages/article/detail.vue | 资讯详情页（富文本渲染） |
| miniprogram/src/pages/webview/index.vue | 外链 webview（jump_type=外链） |
| miniprogram/src/components/SelectFab.vue | 悬浮选款按钮：MP-05 目标页未落地前回退产品列表 tab |
| miniprogram/src/pages.json | 注册 article list/detail、webview 路由 |
| miniprogram/.env.* | 修正 baseURL 缺 /api/v1（原 .env 漏前缀，接口全 404 的隐患） |
| scripts/e2e/home.auto.js | e2e 脚本（252 行） |

视觉：按 Figma 01-首页 + ds token（LEKASI navy/yellow/cream）。

## 2. Verify 复跑（Hermes 独立复跑，2026-11-06 00:15）

| # | verify 项 | 命令/检查 | 结果 |
|---|---|---|---|
| 1 | 构建 0 报错 | `npm run build:mp-weixin` | `DONE Build complete`，exit 0 |
| 2 | /wxapi/home 聚合可达 | `node scripts/e2e/home.auto.js` 首步 + 手动 curl | banners=2 categories=7 services=1 |
| 3 | 关键交互代码核查 | grep index.vue | swiper 轮播、jump_type 分发(navigateTo/switchTab)、scroll-view 服务横滚、Pinia 传分类(核心约定 9)、悬浮按钮回退，均在 |
| 4 | 路由注册 | pages.json | article list/detail、webview 已注册 |
| 5 | e2e 浏览器走查 | `node scripts/e2e/home.auto.js` | **环境阻塞**：`Failed to launch wechat web devTools`（开发者工具需扫码登录 + 开服务端口，automator 前置，用户侧操作）。第 [0] 步接口可达断言通过，后续浏览器断言无法执行 |

## 3. 遗留风险

1. **e2e 浏览器走查未完成**（环境阻塞，非代码缺陷）：需用户先在微信开发者工具扫码登录并开启服务端口（设置-安全-服务端口），再复跑 `node scripts/e2e/home.auto.js`。build 绿 + 接口可达 + 代码核查已覆盖主要风险。
2. **MP-04/MP-05 未落地**：产品详情、方案中心页未建（属 MP-04/05 任务），首页 jump 目标按 CC 设计做了回退（详情→产品列表、选款→产品列表 tab），不留死链。
3. **客服 wx.openCustomerServiceChat**：配置占位，需后台配真实客服账号后联调。

## 4. 范围守护

未动：backend/、其他 MP 页面（product/detail、scheme、user）；未提交 AGENTS.md/tasks.json；未触碰用户 untracked 文件（jp/、figma-exports/、CLAUDE.md、部署.md）。

## 5. 结论

**approved（代码层面）**。build 绿 + 接口聚合可达 + 关键交互代码齐全。e2e 浏览器走查因开发者工具登录前置阻塞，属环境待办，不阻塞代码通过；用户完成扫码后可补跑 home.auto.js 完整断言。MP-02 置 done。
