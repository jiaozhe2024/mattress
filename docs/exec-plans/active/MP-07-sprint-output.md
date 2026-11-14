# MP-07 Sprint Output — V3 全局复用层（design tokens + WechatNav + SafeArea + TabBar variant + 图标）

- 任务：MP-07（tasks.json，priority=high，blocked_by 无）
- 执行：CC 前端会话（`proc_4d86`），**在跑满 60 分钟时被 cc-watchdog 判挂死 SIGKILL（exit -9）**
  - 看门狗日志：`[2026-11-14 14:50:08] KILL pid=18952 session=c4a354f8... etime=01:00:04`
  - **实际代码已写完**（组件 4 个 + 纯函数 2 个 + 7 个测试文件 + e2e 脚本 + pages.json/uni.scss 改造），
    仅缺 sprint-output 与 commit 两步。由 Hermes 接手补完并复跑验收。
- 结论：verify 1/2/3/5 全过，verify 4（e2e）静态段 4/4 过、automator 动态段被开发者工具登录前置阻塞（如实记录，未伪造）

## 1. 交付清单

### 1.1 设计令牌

| 文件 | 内容 |
|---|---|
| `src/styles/tokens.scss` | 246 行。全量 token 真值，**只声明变量/函数/mixin，不输出任何 CSS 规则**（避免经 uni.scss 注入每组件后重复打包） |
| `src/uni.scss` | 首行 `@import "@/styles/tokens.scss"`，使 SCSS 变量在所有 `<style lang="scss">` 中可用 |
| `src/App.vue` | `page { @include token-css-vars; }` —— CSS 自定义属性唯一出口 |

token 与 `design-tokens.md` 逐项对照：

| 类别 | 数量 | 内容 |
|---|---|---|
| 颜色（已登记） | 11 | navy #1a2260 / navy-soft #e7eaf6 / navy-50 #8890b8 / yellow #f7c400 / yellow-bg #fff8e1 / cream #fdfbf5 / text-1 #1e2330 / text-2 #4a5165 / text-3 #8a90a3 / text-inv #ffffff / line #e9ecf2 |
| 颜色（硬编码） | 4 | fill #f4f6fa / yellow-soft #fff3c4 / yellow-deep #6b4e00 / navy-deep #111639 |
| 投影 | 2 | shadow-card `0 4px 8px rgba(26,34,96,0.06)` / shadow-fab `0 6px 8px rgba(26,34,96,0.25)` |
| 圆角 | 11 | 2/4/6/8/11/12/16/18/20/26/999 |
| 字体族 | 2 | font-family-cn（Noto Sans SC）/ font-family-en（Inter） |
| 字重 | 4 | regular 400 / medium 500 / semibold 600 / bold 700 |
| 字号阶梯 | 16 | 31/30/28/27/23/21/19/18/17/15/14/13/12/11/10/9，每档配行高 token |
| 间距 | 6 | 4/8/12/16/24/32 |

另有 `px2rpx()`（750 设计宽，1px = 2rpx）。

### 1.2 全局组件

| 文件 | 规格落实 |
|---|---|
| `components/frame/WechatNav.vue` | h44 标题导航，左右 padding 16；一级页左侧 LEKASI（Inter Bold 12 navy 字距 2）；二级页 chevron-left 22×22 且**透明热区 44×44**（Q13）；中间标题 Noto Sans SC Bold 15 text1 居中；props: title / back / fixed / background；fixed 时内置 spacer 占位 |
| `components/frame/SafeArea.vue` | 高度 `max(22px, env(safe-area-inset-bottom))`（比写死 22px 更稳，真实机型不被 Home Indicator 遮挡）；手势条 120×4 圆角 4 text1 |
| `components/frame/TabBar.vue` | `variant: 'three' \| 'two'` **同一组件两套结构**（Q1 决议）；h58 / px28 / 上边框 1px line；单项宽 64 / gap3 / 图标 24 / 文字 10px；选中文字 navy 不透明，未选中 text2 + 整体 opacity 0.6；two 版「返回」项走 navigateBack，失败 reLaunch 首页 |
| `components/frame/tabBarModel.ts` | TabBar 项配置与选中态计算抽成纯函数，供组件与单测共用 |
| `components/icons/Icon.vue` + `utils/iconSvg.ts` | 内联 SVG（**不引第三方图标包**），覆盖 home / grid / user / undo-2 / chevron-left / chevron-right / chevron-down / search / list / pencil / plus / share / qr-code / message-circle / newspaper 共 15 个 |

### 1.3 导航布局计算

`utils/navLayout.ts`（186 行）—— 纯函数 + 副作用分离：

- `resolveNavLayout(input)` 纯函数：按 `navBarHeight = (胶囊 top - 状态栏高) × 2 + 胶囊高` 反推
- `isValidMenuRect()` 合理性校验：胶囊宽 20~屏宽、高 16~48、top ≥ 状态栏-4、bottom ≤ 状态栏+56、right ≤ 屏宽+1
- `readNavLayout()` 包裹 `getMenuButtonBoundingClientRect()` / `getSystemInfoSync()`，**两个 API 各自 try/catch**，任何抛错或缺失都回落兜底（状态栏 32 + 导航 44 = 76，右留白 76+16），绝不让导航渲染失败
- 返回 `fallback: boolean` 便于排查真机异常

### 1.4 配置改造

- `pages.json`：**7 个页面**（原 6 个 + 新增 `pages/frame/preview` 校验页）全部 `navigationStyle: "custom"`，`globalStyle` 同步
- `pages.json` tabBar：`custom: true`，补齐三项 `iconPath` / `selectedIconPath`（6 张 png 落在 `src/static/tabbar/`）
- `src/custom-tab-bar/`：index.js/json/wxml/wxss 四件套，指向同一套 TabBar 视觉
- `vitest.config.ts`：接入 `@vitejs/plugin-vue`，把 uni 内置标签（view/text/image/swiper…）声明为 custom element，使 `.vue` 组件可在 node 环境单测
- `package.json`：新增 devDependency `sass`（tokens.scss 需要 SCSS 预处理器；uni.scss 原本就在用 SCSS，只是未显式声明）

## 2. verify 逐项实测

| # | verify 项 | 结果 | 实测 |
|---|---|---|---|
| 1 | `npm run build:mp-weixin` 0 error | **PASS** | `DONE Build complete.`（编译器 5.34 vue3） |
| 2 | pages.json 全部页面 navigationStyle=custom 且 tabBar.custom=true | **PASS** | e2e 静态断言 1、2 通过（7 页 custom）；tabBar.custom=true + 3 项 |
| 3 | vitest 全绿（tokens/TabBar/WechatNav/兜底） | **PASS** | **16 files / 183 tests passed**（本轮新增 6 个测试文件 99 用例：tokens 72、tabBar 10、wechatNav 7、icon 7、safeArea 3） |
| 4 | `node scripts/e2e/frame.auto.js` 截图产出且断言通过 | **PARTIAL（环境阻塞）** | 静态段 4/4 通过（custom 页面数、tabBar 配置、custom-tab-bar 四件套 + 6 图标、token CSS 变量注入 app.wxss）；**automator 动态段超时 exit 124** —— 微信开发者工具需扫码登录并开启「设置-安全设置-服务端口」，属已知前置，与 MP-02/MP-03 同类。**未伪造输出** |
| 5 | tokens.scss 与 design-tokens.md 逐项一致 | **PASS** | 上表逐项对照；tokens.test.ts 中「仅允许 15 个颜色 token（无自定义色）」「字号恰好 16 档」「每档配行高」「全量导出 CSS 自定义属性」四条断言守住不漂移 |
| 6 | TabBar 选中/未选中态与 references/home.png 一致 | **PARTIAL** | 尺寸/色值/opacity 与 visual-checklist §底部 Tab 逐条一致；像素级截图比对待 automator 解锁 |
| 7 | 无 `V3 · 参考复刻优化版` 版本条 | **PASS** | 全仓 grep 无该字符串 |

## 3. Hermes 接手修正

CC 被 kill 时遗留一处规范违例，由 Hermes 修掉：

**问题**：4 个全局组件把色值/字体族硬编码在 `<style>` 里，未引用 tokens.scss（`grep $color-` 命中 0 次），
违反 tokens.scss 自己写下的「页面层禁止自定义色值」约定，也让 token 失去单一真值意义。

| 文件 | 修正 |
|---|---|
| `TabBar.vue` | `#ffffff`→`$color-text-inv`、`#e9ecf2`→`$color-line`、`#4a5165`→`$color-text-2`、`#1a2260`→`$color-navy`、字体族→`$font-family-cn` |
| `WechatNav.vue` | `#1a2260`→`$color-navy`、`#1e2330`→`$color-text-1`、字体族→`$font-family-en`/`$font-family-cn`、`700`→`$font-weight-bold` |
| `SafeArea.vue` | `#1e2330`→`$color-text-1`、`4px`→`$radius-4` |

**保留的例外**：`Icon.vue` 的 `color` prop 默认值、`WechatNav.vue` 传给 Icon 的 `color="#1e2330"`、`background: "#ffffff"` 默认值 —— 这些是 JS 运行时值（传给 SVG 的 currentColor / inline style），无法使用 SCSS 变量。属合理例外，非违例。

修正后复跑：`183 tests passed`、`Build complete`，均无回归。

## 4. 未决与风险

1. **automator 动态走查未完成**（exit 124 超时）：需用户在微信开发者工具扫码登录并开启服务端口后复跑 `node scripts/e2e/frame.auto.js`，届时可补出三页截图与 TabBar/导航元素断言。
2. **像素级视觉比对未做**：需参考图与运行截图并排比对，依赖上条解锁。
3. `pages/frame/preview` 是 MP-07 自建的**校验用临时页**，用于 e2e 展示三种导航/TabBar 组合。**上线前应删除**（已记入本节风险）。后续 MP-02 起各页会自行挂载 WechatNav/TabBar，该页无业务价值。
4. `sass` 依赖新增：属必要（SCSS 编译），非违规引入第三方 UI/图标库。
5. TabBar `two` 版目前无页面实际使用（产品详情页 MP-04、产品页 MP-03B 落地后才会有）。组件已备好，等页面接入验证。
