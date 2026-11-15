# MP-05A 选品页 · Sprint Output

> 状态：**代码 + 单测 + e2e 脚本已交付；vue-tsc 0 error、vitest 386/386 全绿、build:mp-weixin 0 error 均已实测。**
> e2e 静态段 **39/39 PASS**；动态段因微信开发者工具自动化端口 9420 未开启按环境阻塞（exit 2）上报，未伪造结果。

## 任务范围（tasks.json MP-05A）
新建 `miniprogram/src/pages/scheme/selection.vue`，依据 `references/plan-02-picker.png` + `spec.md §5.6`，
并落实 Q10（右栏自适应，禁止硬编码 126.92px）/ Q11（字号取整 10/8/8）/ Q12（不做版本条）/ Q13（+/✓ 透明热区 ≥44×44）。
选品状态全程走 `useSelectionStore`（核心约定 9）。未改动 `pages/index/index.vue`、`pages/product/list.vue`、
`pages/product/category.vue`、`pages/product/detail.vue`（均已验收）。

## 交付文件

| 文件 | 说明 |
|---|---|
| `miniprogram/src/pages/scheme/selection.vue` | 选品页（新增，V3 还原） |
| `miniprogram/src/components/scheme/schemeSelectionModel.ts` | 选品页纯函数/常量/文案收敛（新增） |
| `miniprogram/src/pages.json` | 注册 `pages/scheme/selection`（navigationStyle=custom） |
| `miniprogram/src/config.ts` | `SELECTION_PAGE` 指向真实页（原为占位） |
| `miniprogram/tests/schemeSelectionModel.test.ts` | model 单测 13 项（新增） |
| `miniprogram/tests/schemeSelectionPage.test.ts` | 页面挂载/交互/错误态单测 20 项（新增） |
| `miniprogram/tests/schemeSelectionStyle.test.ts` | 样式/注册静态约束单测 20 项（新增） |
| `scripts/e2e/scheme-selection.auto.js` | 双重分段 e2e（静态 39 项 + automator 动态，新增） |
| `docs/exec-plans/active/MP-05A-sprint-output.md` | 本文件 |

## 逐区块规格核对（spec.md §5.6）

| 区块 | 规格要求 | 实现 | 静态断言 |
|---|---|---|---|
| 导航 | WechatNav 二级页（back），标题 `LEKASI 乐卡思` | `<WechatNav :title="SELECTION_NAV_TITLE" back />` | PASS |
| ①搜索区 | px16 py12；框 327×36 圆角 18 bg fill | `.ss-search-area` / `.ss-search-box`（`max-width:100%` 兜底窄屏） | PASS |
| ①搜索图标 | icon/search 16×16 left14 top10 | `.ss-search-icon` `top:$space-10;left:14px;16×16` | PASS |
| ①输入 | 占位「输入型号搜索」Regular 13 text3 | `:placeholder="SELECTION_SEARCH_PLACEHOLDER"` + `$font-13` + `$color-text-3` | PASS |
| ①搜索逻辑 | 按型号过滤；空结果不做插图（Q8 DEFERRED） | `debounce 300ms` → `applyKeyword`；空态仅文案 | PASS |
| ②左分类栏 | 宽 94 / bg fill / gap4 / item h56 px8 | `.ss-cats` 94px + `$space-4`；`.ss-cat-item` h56 + `0 $space-8` | PASS |
| ②激活项 | 白底 + 左指示条 3×16 yellow top20 + navy 字 | `.ss-cat-item--active` + `.ss-cat-indicator` | PASS |
| ②未激活 | bg fill + text2 Regular 12 居中 | `.ss-cat-text` `$color-text-2` `$font-12` | PASS |
| ②右栏 | 自适应宽（Q10）/ bg fill / px9 pb12 / 行距 10 / 列距 8 / 两列 | `.ss-products{flex:1;min-width:0}`；`.ss-grid{row-gap:$space-10;column-gap:$space-8;padding:0 $space-9 $space-12}` | PASS |
| ②产品卡 | 白底圆角 12 shadow/card；卡宽由容器 calc 决定 | `.ss-card{width:calc((100% - #{$space-8}) / 2);border-radius:$radius-12;box-shadow:$shadow-card}` | PASS |
| ②卡内容 | 主图 114；内容 left9 top119；产品名 Medium 10 text1 | `.ss-card-media` h114；`.ss-card-info` top119 left `$space-9`；`.ss-card-name` `$font-10` | PASS |
| ②规格/标签 | 规格 Inter Regular 8 text3；舒适睡感 r8 yellowSoft Medium8 yellowDeep；查看详情 r3 fill Regular8 text3 | `.ss-card-spec` / `.ss-card-feel` / `.ss-card-detail`（合计 3 处 `font-size:8px`） | PASS |
| ②操作钮 | 21×21 圆角 11；未选 yellow + “+” navy；已选 line + “✓” text3 | `.ss-card-action-btn` 21×21 `$radius-11`；`--selected` 态覆盖 | PASS |
| Q13 热区 | 透明热区 ≥44×44，视觉仍 21×21 | `.ss-card-action` 44×44（`@tap.stop` 不触发开详情）+ 内层 21×21 | PASS |
| ③已选栏 | bg navy p12 gap10 居中 | `.ss-selected-bar{background-color:$color-navy;padding:$space-12;gap:$space-10;align-items:center}` | PASS |
| ③缩略图区 | 宽 150 gap6；可移除缩略图 49×55 圆角 4 bg cream；图 49×38 | `.ss-thumb-area`（`flex:0 1 150px`）/ `.ss-thumb-track` gap6 / `.ss-thumb` 49×55 / `.ss-thumb-image` 49×38 | PASS |
| ③缩略图 × | Inter Regular 12 navy 居中 | `.ss-thumb-remove` `$font-family-en` `$font-12` `$color-navy` | PASS |
| ③计数 | 「已选：N」Regular 12 textInv lh1.45 | `.ss-count` + `selectedCountText()`（`已选：` 全角冒号） | PASS |
| ③OK | 90×42 圆角 20 bg yellow Medium 15 navy | `.ss-ok` / `.ss-ok-text` `$font-15` `$line-height-15-fixed` | PASS |
| 交互·分类 | 点分类切换 | `onCategoryTap` → `restoreCategory` | PASS |
| 交互·加/减 | 点 +→加入 store、变 ✓、计数 +1；点 ✓→移除、变 +、计数 -1 | `onToggleProduct` → `addProduct/removeProduct` | PASS |
| 交互·缩略图 | 点 × → 移除 | `onThumbRemove` | PASS |
| 交互·OK | 跳方案编辑页；MP-05B 未落地 → toast 兜底且选品保留 Pinia | `onOk` → `SCHEME_EDIT_PAGE` + fail toast `SCHEME_EDIT_PENDING_TOAST` | PASS |
| ④版本条 | 不实现（Q12） | 无 `version-bar` / 无「参考复刻优化版」 | PASS |
| 核心约定 9 | 选品走 Pinia，禁 storage/全局 | `useSelectionStore`；页面无 `setStorageSync` | PASS |

## 关键疑问项落实

| 项 | 要求 | 落实方式 | 证据 |
|---|---|---|---|
| **Q10** | 右栏卡宽按 375 屏自适应，**禁止硬编码 126.92px** | `width: calc((100% - 8px) / 2)`，由容器实际宽度决定 | 编译产物 `selection.wxss` 含 `calc((100% - 8px)/2)`，`126.92` 出现 **0** 次；vitest + e2e 双重断言 |
| **Q11** | 字号取整为 10 / 8 / 8 | 产品名 `$font-10`；规格与两个标签均 `font-size: 8px`（恰 3 处） | 编译产物 `font-size:10px`×1、`font-size:8px`×3；无 `9.88/7.6/8.36` 声明 |
| **Q13** | 21×21 的 +/✓ 必须挂 ≥44×44 透明热区 | 外层 `.ss-card-action` 44×44，内层 `.ss-card-action-btn` 21×21 | 编译产物 `44px`×3（宽、高、另一处）；e2e 动态段将实测 size |
| **Q12** | 不实现版本标识条 | 未加入任何版本条 DOM/样式 | vitest + e2e 断言无 `version-bar`/「参考复刻优化版」 |

## 实测验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| type-check | `npx vue-tsc --noEmit` | **EXIT 0，stdout/stderr 均空（0 error）** |
| 单测（全量） | `npx vitest run` | **28 files / 386 tests 全绿**（基线 333 + 新增 53） |
| 单测（本任务新增） | 三个 schemeSelection*.test.ts | **3 files / 53 tests 全绿**（model 13 + page 20 + style 20） |
| 构建 | `npm run build:mp-weixin` | **EXIT 0，DONE Build complete**（`dist/build/mp-weixin/pages/scheme/selection.{js,json,wxml,wxss}` 产出） |
| 编译产物核对 | 检查 selection.wxss | `calc((100% - 8px)/2)` 存在；`126.92` = 0；`font-size:10px`×1、`font-size:8px`×3；`44px`×3 |
| dev 产物 | 监听构建至 selection.js 落地 | `dist/dev/mp-weixin/pages/scheme/selection.{js,json,wxml,wxss}` 已生成（原先为 MP-04 旧产物） |
| e2e 静态段 | `node scripts/e2e/scheme-selection.auto.js` | **PASS=39 FAIL=0**（接口 products.total=11 / categories=8；token 合规 hex=0 / 裸 px 间距=0 / 裸行高=0） |
| e2e 动态段 | 同上 | **环境阻塞 exit 2**：`127.0.0.1:9420 connect ECONNREFUSED`（DevTools 自动化服务端口未开启） |

> 动态段防挂死：`automator.launch` 在服务端口未开时会阻塞 Node 事件循环，定时器看门狗也救不回来
> （MP-03A 63min、MP-03B 8h 两次收尾挂死同源）。本脚本在 launch 前先做 TCP 预检 `checkAutomationPort()`，
> 未开启即打印 `[环境阻塞]` 并 exit 2，同时保留静态段完整结果，绝不挂死、绝不伪造。

## 遗留风险
1. **动态段未实测**：微信开发者工具未开启「设置-安全设置-服务端口」，automator 无法启动。
   分隔栏宽 94、指示条 3×16、两列卡宽、44×44 热区、点 +/✓ 计数、缩略图移除、OK 跳转等**动态断言尚未在真机/模拟器验证**；
   这些行为目前仅由 20 项页面单测（@vue/test-utils + jsdom）覆盖，需开启端口后复跑 e2e 确认。
2. **截图未生成**：同因动态段阻塞，`docs/exec-plans/screenshots/mp05a-scheme-selection.png` 未产出，尚不能与
   `references/plan-02-picker.png` 做逐区块像素比对。
3. **搜索图标/占位色**：Icon 的 color 进 SVG data URI，无法取 CSS 变量，页面 script 内镜像了
   `SEARCH_ICON_COLOR = "#8a90a3"`（`$color-text-3` 值）。这是本页唯一的 JS 端 hex，已在单测中显式白名单。
4. **窄屏兜底**：搜索框 `max-width:100%`、缩略图区 `flex:0 1 150px`、计数 `nowrap` 为防溢出兜底，
   与 375 基线稿一致，但 320 宽度下未做视觉验证。
5. **方案编辑页（MP-05B）未落地**：OK 走 `navigateTo` fail → toast 兜底，选品保留在 Pinia；
   MP-05B 落地后需复跑 e2e 的「OK 跳转」分支（当前脚本会自动识别 `pages/scheme/edit` 是否存在）。

## 提交记录
```
d83763a feat(mp-05a): 选品页骨架——双栏分类 + 产品网格 + 已选栏 + Pinia 选品
e1348f8 test(mp-05a): 选品页页面交互 20 项 + 样式/注册静态约束 20 项
178829e test(mp-05a): e2e 双段脚本——静态 39 项全过 + DevTools 端口预检防挂死
```

## 复跑命令
```
cd miniprogram && npx vue-tsc --noEmit && npx vitest run && npm run build:mp-weixin
npm run dev:mp-weixin        # 另开终端，保证 dist/dev 含 selection 页
# 微信开发者工具开启「设置-安全设置-服务端口」并登录后：
node scripts/e2e/scheme-selection.auto.js
```
