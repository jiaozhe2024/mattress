# MP-02 Sprint Output — 首页 V3 整块重写（品牌主视觉 / 4 系列卡 / 3 寝具入口 / 好眠服务 / 快捷入口）

- 任务：MP-02（tasks.json，priority=high，blocked_by=MP-07 + BE-10，均已验收）
- 执行：CC（frontend），2026-11-14
- 状态：submitted（待 Hermes 复跑验收）
- 依据：`docs/design/references/home.png` + `design-spec/spec.md §5.1` + `open-questions.md` Q14/Q15 + `design-spec/design-tokens.md` + `acceptance/visual-checklist.md §首页`

## 1. 交付内容

### 1.1 新增

| 文件 | 说明 |
|---|---|
| `miniprogram/src/pages/index/index.vue` | 首页整块重写（旧 V2 布局删除，非改造） |
| `miniprogram/src/components/home/homeModel.ts` | 首页静态内容 + 纯展示逻辑（系列卡排序截断 / 双通道渲染 / 指示点数量） |
| `miniprogram/src/components/frame/SelectFab.vue` | V3 选款胶囊 64×42 / 圆角 20 / bg yellow / right12 bottom90 / 角标 99+ 封顶 |
| `miniprogram/tests/homeModel.test.ts` | 17 个用例：静态文案、排序截断、图片/文字双通道、失败降级、指示点数量 |
| `miniprogram/tests/homePage.test.ts` | 19 个用例：六区块结构、轮播、系列/寝具/服务/快捷入口、交互、三态、旧结构缺席 |
| `miniprogram/tests/selectFab.test.ts` | 5 个用例：尺寸类名、角标显隐/封顶、点击跳转与回退 |

### 1.2 修改

| 文件 | 说明 |
|---|---|
| `miniprogram/src/types/home.ts` | `WxCategory` 补 `subtitle` / `banner_image`（对齐 BE-10 契约） |
| `miniprogram/src/stores/useProductFilterStore.ts` | 新增 `requestedKeyword` + `requestKeyword()`，与分类**互斥**（后写覆盖前写） |
| `miniprogram/src/pages/product/list.vue` | `onShow` 消费 `requestedKeyword`（Q15 寝具入口 → 按型号搜索，同步搜索框文本与历史）；改引 `frame/SelectFab`；修 `onInput` 事件类型（DOM `InputEvent` 与小程序载荷冲突） |
| `miniprogram/src/main.ts` | 移除旧全局 `SelectFab` 注册（改局部引入） |
| `miniprogram/tests/useProductFilterStore.test.ts` | 3 → 5 用例（补关键词通道与互斥语义） |
| `scripts/e2e/home.auto.js` | 整体重写（旧断言针对 7 宫格 / 服务横滚） |

### 1.3 删除

| 文件 | 说明 |
|---|---|
| `miniprogram/src/components/SelectFab.vue` | MP-01 的 56rpx 圆形 FAB，统一由 `frame/SelectFab.vue` 替代 |

## 2. 逐区块规格对照

| # | 设计规格（spec.md §5.1） | 实现 | 结果 |
|---|---|---|---|
| ① | 品牌主视觉卡 bg navy 圆角 16 | `.home-hero` `$color-navy` / `$radius-16` | PASS |
| ① | 文案区 px24 pt24 pb16 gap8 | `padding: 24px 24px 16px` + `gap: 8px` | PASS |
| ① | `LEKASI 乐卡思` Inter Bold 13 yellow 字距 2 | `.home-hero-brand` `$font-family-en` / `$font-13` / 700 / `$color-yellow` / `letter-spacing: 2px` | PASS |
| ① | 两行标题 Noto Bold 30 textInv 行高 1.25 | 两行 `<text>` / `$font-30` / `$line-height-30` | PASS |
| ① | 副标题 Regular 12 textInv 行高 1.45 | `$font-12` / `$line-height-12` | PASS |
| ① | 场景图 h190 object-cover | `.home-hero-swiper` 190px + `mode="aspectFill"` | PASS |
| ① | 轮播指示 h24 居中 gap5；激活 16×4 圆角条 yellow；其余 4×4 圆点 navy50 | `.home-hero-indicator` / `.home-hero-dot(--active)` | PASS |
| ① | Q14：轮播保留，autoplay 5s，数量随 banners，1 张隐藏，空则退化静态卡 | swiper `autoplay :interval="5000"`；`bannerIndicatorCount()` | PASS |
| ② | 2×2 系列卡白底 h76 圆角 8 gap5 居中 | `.home-series-grid` / `.home-series-card` | PASS |
| ② | 标题 Bold 19 navy + 副文案 Regular 11 text3 | `.home-series-title` / `.home-series-subtitle` | PASS |
| ② | Q15 双通道：banner_image 非空铺满图片，否则文字 | `seriesCardViewsOf()` + `.home-series-image` | PASS |
| ② | 点击 → 产品页带 category_id | `filterStore.requestCategory()` + `switchTab` | PASS |
| ③ | 3 寝具白底 h90 圆角 8 gap6 居中 | `.home-bedding-row` / `.home-bedding-card` | PASS |
| ③ | 型号 Inter Bold 28 navy + 名称 Regular 12 navy | `.home-bedding-model` / `.home-bedding-name` | PASS |
| ③ | Q15：非分类，点击 → 产品 tab 按型号搜索（Pinia keyword） | `filterStore.requestKeyword()` | PASS |
| ④ | 标题 Bold 17 text1 | `.home-services-title` | PASS |
| ④ | 3 服务卡：图 h80 object-cover + 文字区 px6 pb10 gap3 | `.home-service-media` / `.home-service-text` | PASS |
| ④ | 标题 Medium 12 navy + 说明 Regular 9 text3 | `.home-service-title` / `.home-service-caption` | PASS |
| ⑤ | 2 快捷入口 bg yellowBg h62 圆角 8 gap10 居中，icon 21×21 + Regular 13 navy | `.home-entries` / `.home-entry-card` / `Icon :size="21"` | PASS |
| ⑤ | 乐卡思资讯 → `/pages/article/list`（不 toast） | `goNews()` | PASS |
| ⑤ | 联系客服 → `wx.openCustomerServiceChat`，失败兜底 toast | `onContactTap()` | PASS |
| ⑥ | FAB 64×42 圆角 20 bg yellow right12 bottom90，文字 Medium 15 navy 行高 22 | `frame/SelectFab.vue` | PASS |
| ⑥ | 已选数量 >0 显示角标（胶囊右上） | `.select-fab-badge` | PASS |
| ⑦ | 底部 TabBar three 首页选中 | 原生 `custom-tab-bar`（既有，无需改动） | PASS |
| ⑧ | 不实现版本标识条（Q12） | 无该节点；e2e 断言缺席 | PASS |
| ⑨ | 加载/空/错误三态内联；不做骨架屏（Q8） | `pageStatus` + `isEmptyHome` + 重试按钮 | PASS |
| — | 无 7 分类宫格 / 无服务横滚 / 无「更多系列」 | 旧结构全部删除 | PASS |

### 设计 token 红线

- 首页与 SelectFab 的 `<style>` 中 **0 处 hex / rgba 硬编码**（脚本校验通过），全部来自 `tokens.scss` 变量。
- 尺寸按 375 设计宽 1:1 输出（设计稿 px 直接落 px，微信按 750 设计宽等比缩放到设备宽度，与既有 MP-03/MP-07 页面一致）。

## 3. 验证结果

### 3.1 单元测试（vitest）

```
Test Files  19 passed (19)
     Tests  226 passed (226)
```

基线 183 → 226（+43）。新增：homeModel 17、homePage 19、selectFab 5；filter store 3 → 5。

```
✓ tests/homeModel.test.ts       (17 tests)
✓ tests/homePage.test.ts        (19 tests)
✓ tests/selectFab.test.ts       (5 tests)
✓ tests/useProductFilterStore.test.ts (5 tests)
（其余 15 个文件保持原状全绿，含 tokens 72 用例）
```

### 3.2 构建

```
$ npm run build:mp-weixin
编译器版本：5.34（vue3）
正在编译中...
DONE  Build complete.
exit 0
```

### 3.3 类型检查

```
$ npm run type-check
$ vue-tsc --noEmit
exit 0
```

（顺带修掉本页既有 TS 报错：`product/list.vue` 局部 `InputEvent` 与 DOM `InputEvent` 同名冲突。）

### 3.4 E2E（`node scripts/e2e/home.auto.js`）

**环境阻塞（exit 124，超时）**。脚本第 [0] 步已确认后端可达：

```
[0] 接口可达：banners=2 categories=8
```

随后 `automator.launch()` 无返回，进程在 420s 内未继续，判定为微信开发者工具自动化通道未就绪（未登录 / 服务端口未开启）。**未伪造后续断言结果**。用户完成扫码登录并开启「设置 → 安全设置 → 服务端口」后可复跑：

```bash
cd miniprogram && node ../scripts/e2e/home.auto.js
```

脚本断言已按 tasks.json verify 重写：主视觉卡 + swiper 可切换（`swipeTo(1)`，失败退化为等待 autoplay）、系列卡=4 且副文案非空（或图片通道）、寝具=3 + 点 9B 进产品页 `keyword=9B`、服务卡=3、快捷入口=2 + 资讯跳转、FAB 64×42 胶囊且非圆形、旧 V2 结构 + 版本条缺席、截图存 `docs/exec-plans/screenshots/mp02-home.png`。

## 4. 遗留问题与风险

1. **seed 无 9B/9D/9P 产品**：`GET /wxapi/products?keyword=9B` 当前返回 0 条。链路本身正确（Pinia keyword → 搜索框回填 → 接口调用），但空结果页会展示「未找到「9B」相关产品」。待 BE 侧补型号数据或确认寝具入口的实际检索口径。
2. **图片缺失**：`/uploads/demo/*` 与 banner 图当前 404，页面走占位层（banner 用 `navy-deep` 底色，服务卡用 `fill` 底色）。素材补齐后无需改代码。
3. **首页服务图 ×3 为空字符串**：`HOME_SERVICE_CARDS[].image` 按 asset-inventory 待补素材，当前恒走占位层。
4. **客服配置占位**：`CUSTOMER_SERVICE` corpId / kfUrl 为占位值，需运营回填后联调。
5. **FAB 定位语义**：设计稿写「绝对定位 right12 bottom90」，实现用 `fixed`（同坐标）以保证滚动常驻，兼容 MP-01 骨架 e2e 的「悬浮按钮」语义。若严格按「随内容滚动」要求，改为 `absolute` 即可（页面根已 `position: relative`）。
6. **产品列表页自身 V3 还原**：本任务只补关键词通道与 FAB 替换，页面结构仍待 MP-03B 重写（该页顶部注释已标注）。

## 5. 范围守护

- 未改动 `backend/`、`tasks.json`、`docs/design/`。
- 未改动 MP-07 的 WechatNav / SafeArea / TabBar / tabBarModel / Icon。
- 未提交 `.tmp-home-crops/`（本地临时裁图脚本，已删除）。
- 提交范围：`miniprogram/` + `scripts/e2e/home.auto.js` + 本文件。
