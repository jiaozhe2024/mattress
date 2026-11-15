# MP-06 Sprint Output — 我的（品牌卡 + 客服卡，无选款 FAB）

- 任务：MP-06（tasks.json，priority=medium，blocked_by=MP-07 + BE-05，均已 done）
- 执行：**Hermes 直接实现**（延续 MP-05C/D 的处理：CC 会话上下文膨胀会触发网关 402）
- 结论：静态验收全过（62 项）；动态段受 DevTools 服务端口阻塞，如实记录

## 1. 交付清单

| 文件 | 内容 |
|---|---|
| `pages/user/index.vue` | 整页重写（原为 615 字节占位页）：品牌卡 + 空间图 + 联系入口 + 客服卡 |
| `components/user/mineModel.ts` | 文案常量 + `introLinesOf`/`spaceImageOf`/`joinPhoneOf`/`hasCustomerServiceConfig` |
| `api/content.ts` | 补 `getBrand()`（匿名只读，`silent: true`） |
| `types/home.ts` | 补 `WxBrandInfo`（对齐 backend `WxBrandOut`） |
| `styles/tokens.scss` | 补 `$space-26`（spec §5.10 品牌卡 pt26，原阶梯缺失） |
| `tests/mineModel.test.ts` | 18 项单测 |
| `scripts/e2e/mine.auto.js` | 62 项静态断言 + 动态段 + 硬超时 |

## 2. 尺寸实测（设计稿像素测量）

设计稿 350px 宽 = 设计 375px，缩放系数 0.9333。逐点采样核对：

| 项 | 稿内实测 | 实现 |
|---|---|---|
| 品牌卡底色 | `#1a2260` = `$color-navy` | ✓ |
| 品牌卡左右外边距 | 4px（x=0..3 为白） | `p4` |
| 客服卡底色 | `#111639` = `$color-navy-deep` | ✓ |
| 客服卡左右外边距 | 4px | `p4` 同容器 |
| 空间图高度 | 315px（y=330..624，含圆角） | `height: 315px` |
| 黄按钮 | x=72..277 → 205px 截图宽 ÷ 0.9333 ≈ **220px** | `width: 220px` |
| 黄按钮高 | y=682..722 → 40px ÷ 0.9333 ≈ **42px** | `height: 42px` |
| 客服图标色 | `#f7c400` = `$color-yellow` | `MINE_SERVICE_ICON_COLOR` |

## 3. verify 逐项实测

| # | verify 项 | 结果 | 实测 |
|---|---|---|---|
| 1 | build 0 error | **PASS** | `DONE Build complete.` |
| 2 | 品牌卡 bg #1a2260 | **PASS** | `$color-navy`，e2e 静态断言过 |
| 3 | 主标语 31px 居中 | **PASS** | `$font-31` + `$font-weight-medium` + `text-align:center` |
| 4 | 强调条 72×3 | **PASS** | `width:72px; height:3px` |
| 5 | 空间图 315 高 | **PASS** | `height: 315px` |
| 6 | 了解乐卡思 220×42 | **PASS** | `width:220px; height:42px` |
| 7 | 客服卡 bg #111639 | **PASS** | `$color-navy-deep` |
| 8 | 三列服务项各含名称+说明 | **PASS** | `MINE_SERVICE_ITEMS` 3 项，名称 12px / 说明 10px navy50 |
| 9 | TabBar「我的」选中 | **PASS** | pages.json + custom-tab-bar 均含 user 项（组件自动按路由同步） |
| 10 | 页面无选款 FAB | **PASS** | 页面无 `SelectFab` 引用 |
| 11 | 截图与 mine.png 逐区块比对 | **未完成** | 动态段环境阻塞 |
| 12 | 无版本标识条 | **PASS** | 模板区无相关文案（Q12） |

补充实测：
- `npx vitest run` → **477 passed / 33 files**（MP-05D 基线 459/32，本轮 +18）
- `npm run type-check` → exit 0
- `npm run build:mp-weixin` → DONE 0 err
- e2e 静态段 → **62 PASS / 0 FAIL**
- token 合规：hex=0 / 裸 px 间距=0 / 裸行高=0

## 4. Hermes 过程中修正

1. **补 `$space-26`**：spec §5.10 品牌卡 `pt26`，token 阶梯只有 24/28 —— 不补会逼出裸值。
2. **e2e 断言两次写错，都是断言自身的问题**（与 MP-05D 同类坑）：
   - 「客服标题 gap10 居中」用了 `[\s\S]{0,240}` 窗口匹配，但 `gap` 与 `justify-content`
     之间隔了 `align-items` + `justify-content`，超出窗口 → 改为在单条规则块内断言。
   - 「Q2 无我的方案入口」「Q12 无版本条」匹配到了**源码注释**（注释里正是在讨论
     「照稿不加我的方案」「不实现版本条」）→ 改为只扫 `<template>` 区。
     **原则：断言要作用在实现产物上，不能作用在解释实现的注释上。**
3. **给 automator 调用加硬超时**（重要）：`miniprogram-automator` 的 `launch` / `reLaunch`
   在 DevTools 未登录或服务端口未开时**无限阻塞**，既无 reject 也无超时参数。
   本轮实测 `reLaunch` 直接挂死。用 `withTimeout(Promise.race)` 兜住 launch(60s) /
   reLaunch(20s) / close(8s)，超时即按环境阻塞退出。
4. **清理一个挂死 23 小时的僵尸进程**：`PID 45161 node scripts/e2e/product-category.auto.js`，
   Nov 14 17:12 启动，CPU 累计 0.82s 完全不增长，socket 连着 wechatwebdevtools 互等。
   外层 Python 包装的超时逻辑 `while time.time()-start < 170: p.stdout.readline()`
   存在缺陷——条件只在 `readline()` 返回后才检查，子进程不吐字符就永远阻塞，
   170 秒兜底形同虚设。已 kill。

## 5. 遗留与风险

1. **动态段未验证**（DevTools 端口 9420 未开）：实际渲染尺寸、截图比对待解锁。
   本轮尝试 `cli auto --auto-port 9420` 只起了 IDE server（随机端口 64343），
   9420 仍需在 DevTools GUI「设置-安全设置」手开服务端口。
2. **客服能力未接通**：`config.ts` 的 `CUSTOMER_SERVICE` 仍是 placeholder，
   `hasCustomerServiceConfig` 会判为未配置 → 点击走 toast 兜底而非调用
   `wx.openCustomerServiceChat`。**运营需在企业微信后台开通后回填 corpId/kfUrl。**
3. **Q2 已知缺口**：「我的」页无「我的方案」入口（spec §5.10 照稿，Q2 DEFERRED）。
   用户从首页出发无法在此找到已保存方案，关键资产缺入口。优化阶段需补。
4. **intro 是一整段时不拆行**：`introLinesOf` 只在完全为空时回落稿内三行，
   有内容时整体作为一行返回。这是刻意选择——运营可能写长段落，按句号强拆会破坏语义。
   若产品要求固定三行，需改用按行/按句拆分规则。

## 6. 任务完成度

| 状态 | 数量 |
|---|---|
| done | **21** |
| cancelled | 3 |
| pending | 1（BE-09） |
| blocked | 1（BE-07，MVP 范围调整） |

**小程序端全部页面完成**：首页、产品分类、产品列表、产品详情、选品、方案编辑、
方案列表、预览分享、我的。剩余仅后端 BE-09（Admin 数据与系统管理）。
