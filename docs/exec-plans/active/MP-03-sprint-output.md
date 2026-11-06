# MP-03 Sprint Output — 产品列表页（搜索/侧分类/排序/选品）功能骨架

- 任务：MP-03（tasks.json，priority=high，blocked_by=用户确认设计稿 + MP-01 + BE-05）
- 本轮范围（用户决策 2026-11-06）：**功能骨架优先** —— 逻辑/数据接线/交互完整，**不做** jp/产品分类列表.jpg 的像素级视觉还原。视觉精修为后续任务，待设计稿确认后另派。当前为干净、朴素、可用的布局。
- 执行：CC 续接会话（**continuation**，见 §1）
- 状态：submitted（未自评、未置 done，待 Hermes 复跑验收）

## 1. 续接说明（本会话为 continuation）

上一会话被中断，遗留一批**未提交**的 MP-03 文件。本会话**先读后接**，在其基础上补全，未推倒重写。接手时已存在（未提交）的内容：

| 文件 | 接手时状态 | 本会话动作 |
|------|-----------|-----------|
| miniprogram/src/pages/product/list.vue | 已改（骨架基本成型） | 复核依赖、确认 onShow 分类交接、保留 |
| miniprogram/src/api/product.ts | 新增 | 复核 BE-05 sort 契约映射、保留 |
| miniprogram/src/composables/useProductList.ts | 新增 | 复核分页/竞态逻辑、保留 |
| miniprogram/src/components/product/ProductCard.vue、SelectedBar.vue | 新增 | 复核、保留 |
| miniprogram/src/utils/debounce.ts、searchHistory.ts | 新增 | 复核、保留 |
| miniprogram/src/config.ts（+SCHEME_EDIT_PAGE）、types/product.ts（+WxProductListItem/WxProductPage） | 已改 | 复核、保留 |

本会话**新增交付**：4 个 vitest 单测文件（31 用例）、e2e 脚本 product-list.auto.js、home.auto.js 向后兼容修正、本 sprint_output。

## 2. 交付内容

### 2.1 数据/逻辑层
- `api/product.ts`：`getProducts`（GET /wxapi/products，默认 page=1/size=10/sort=comprehensive，`{silent:true}` 页面自管三态）、`getCategories`（GET /wxapi/categories）、`toSelectionProduct`（列表项→选品 store 契约映射，剥离 category/sort 等非契约字段）、`backendSortOf`（Tab→后端 sort 映射）。
- `composables/useProductList.ts`：分类/关键词/排序筛选 + 分页（page/size=10，后端上限 50）+ 竞态防护（requestSeq，仅采纳最后一次请求响应）+ loading/ready/error 三态 + hasMore/isEmpty。
- `utils/debounce.ts`：trailing 防抖（带 cancel，页面卸载清定时器）。
- `utils/searchHistory.ts`：本地存储 10 条历史（去重置顶/trim/损坏 JSON 与非字符串项防御回退）。**合规**：核心约定 9 仅禁用 storage 传「选品数据」；搜索历史属页面偏好，允许本地存储（文件头已注明）。

### 2.2 UI 层（骨架）
- `pages/product/list.vue`：搜索栏（300ms 防抖 + 历史面板 focus/blur 延迟隐藏 + 清空按钮）、左侧分类侧边导航（「全部」+ 后端分类，切换 reload）、排序 Tab（综合/推荐/新品）、视图切换（宫格 2 列 ⇄ 列表 1 列）、loading/error/empty 三态内联展示、scroll-view 触底 loadMore + 页脚（加载中/失败重试/没有更多）、底部已选栏。
- **onShow 分类交接**：读 `useProductFilterStore.requestedCategoryId`（首页宫格 / jump_type=2 banner 经 Pinia 传入，tabBar switchTab 不带参，核心约定 9），消费后 clearRequest。与 MP-02 pages/index/index.vue 的 `filterStore.requestCategory(categoryId)` 交接方式一致（已 grep 核对）。
- `components/product/ProductCard.vue`：主图（absoluteUrl + 占位回退层）/名称/型号/规格/睡感标签（自由文本按分隔拆分≤3）+ 圆形「+」按钮 emit add；`added` prop 为真时按钮置灰显「✓」（父层订阅 store 的 selectedIdSet 响应式传入）。
- `components/product/SelectedBar.vue`：已选数量 + 横滚缩略图 + 每图移除「×」 + OK 按钮，emit remove/ok。
- 选品状态：`onCardAdd` 调 `useSelectionStore.addProduct(toSelectionProduct(item))`，已在选品中则 toast「已在选品中」。**全程走 Pinia，无 storage/全局变量传选品**（核心约定 9）。

### 2.3 排序值（BE-05 实际支持）
后端 `backend/src/schemas/wx_content.py ProductSort` 仅两值：`comprehensive`（综合：sort asc,id asc）、`newest`（新品：created_at desc），**无独立「推荐」排序**。故 SORT_TABS 三 Tab（综合/推荐/新品，对齐 jp 图）映射为：综合→comprehensive、**推荐→comprehensive（回退，运营后台维护的 curated sort 序即推荐序）**、新品→newest。后端补推荐排序时只改 `api/product.ts` 的 SORT_TABS 映射表。单测 productApi.test.ts 断言「仅向后端传 comprehensive/newest」。

### 2.4 OK 跳转（MP-05 未落地）
`onBarOk` navigateTo `SCHEME_EDIT_PAGE=/pages/scheme/edit`（MP-05 范围，当前**未建**）→ navigateTo fail 回退 toast「方案编辑建设中（MP-05），已保留 N 款选品」并**保留 Pinia 选品**（不清空）。MP-05 落地后目标页存在即自动生效，无需改本页逻辑（目标为 config 常量）。

## 3. Verify 复跑记录（CC 本会话，2026-11-06）

| # | verify 项 | 命令/检查 | 结果 |
|---|---|---|---|
| 1 | 构建 0 报错 | `npm run build:mp-weixin` | `DONE Build complete`，exit 0 |
| 2 | 单测（debounce/历史/store 集成） | `npx vitest run`（全套） | **10 files / 63 passed**（本轮新增 4 files / 31 用例：debounce 4、searchHistory 10、useProductList 11、productApi 6） |
| 3 | 后端 products/categories 可达 | product-list.auto.js 第 [0] 步 + curl | products.total=7、categories=7、keyword「卷绵」.total=1 |
| 4 | 分类交接一致性 | grep pages/index/index.vue + list.vue onShow | filterStore.requestCategory ↔ requestedCategoryId 闭环，消费后 clearRequest |
| 5 | e2e 浏览器走查 | `node scripts/e2e/product-list.auto.js` | **环境阻塞**：`automator.launch` 挂起 >140s 无返回（微信开发者工具需扫码登录 + 开「设置-安全-服务端口」，与 MP-02 同类阻塞）。第 [0] 步后端可达断言通过，UI 断言无法执行。**未伪造任何 e2e 输出** |

e2e 脚本 product-list.auto.js（11 段断言，语法 node --check 通过，后端基准步已实跑通过）覆盖 MP-03 verify 全部要点：搜索「卷绵」命中渲染、无结果空态、清空恢复、分类切换刷新、排序切换生效、视图切换、点「+」底部栏数量+缩略图更新+按钮置灰、移除归零栏消失、OK 回退。dev 产物 dist/dev/mp-weixin/pages/product/list.* 已确认为真实页（含 pl-search-input/pl-side-item，无 pending-category 占位），与源码 mtime 一致。

## 4. home.auto.js 向后兼容修正（共享 e2e，非 MP-02 页面）

MP-02 的 scripts/e2e/home.auto.js 断言 [3]（jump_type=2 banner 跳产品列表）原检查 `.pending-category` 占位文案。MP-03 起产品列表为**真实页**，该占位类名不复存在，会导致 MP-02 e2e 误红。已改为：跳列表页后校验左侧 `.pl-side-item--active` 高亮项文案 = banner jump_value 对应分类名（数据取自 /wxapi/home 的 categories）。**仅改 e2e 脚本，未动 MP-02 任何页面源码**（pages/index、pages/article、pages/webview 未触碰）。

## 5. 遗留风险 / 待办

1. **e2e 浏览器走查未完成**（环境阻塞，非代码缺陷）：需用户先在微信开发者工具扫码登录 + 开启服务端口，再复跑 `node scripts/e2e/product-list.auto.js`（及回归 home.auto.js）。build 绿 + 63 单测全绿 + 后端可达 + 代码核查已覆盖主要逻辑风险。
2. **视觉为功能骨架**：未做 jp/产品分类列表.jpg + jp/产品页.jpg 像素级还原（本轮用户决策）。设计稿确认后需另派视觉精修任务，「截图对照设计稿」verify 项本轮不适用。
3. **OK 跳方案编辑**：/pages/scheme/edit 属 MP-05，未建，当前回退 toast + 保留选品。MP-05 落地即生效。
4. **产品卡片点击**：`onCardOpen` navigateTo /pages/product/detail（MP-04），未建时 fail 回退 toast，不留死链。
5. **推荐排序**：后端无独立推荐排序，回退 comprehensive；若产品要求真·推荐序，需 BE 侧扩展 ProductSort。
6. **图片资源**：后端图片为 /uploads 相对路径，dev 环境 OSS 适配层未落地可能 404，ProductCard 已有名称首字占位回退层。

## 6. 范围守护

未动：backend/、AGENTS.md、tasks.json（仅按指令改 MP-03 状态为 submitted，**不提交**）、jp/、docs/design/figma-exports/、仓库根中文名文件（部署.md）、CLAUDE.md、docs/CONVENTIONS.md（上一会话 MP-02 遗留改动，非本轮范围，未 stage）、其他 MP 页面源码（pages/index/article/webview）。未实现 MP-04 详情 / MP-05 方案 / MP-06 个人中心。选品状态全程 Pinia，未用 storage/全局变量传选品数据。

## 7. 结论

**功能骨架代码层面完成**：build 0 报错、63 单测全绿（含本轮 31）、后端接口可达、分类交接与选品 store 接线核对一致、e2e 脚本就绪并跑通后端基准步。e2e 浏览器走查因开发者工具登录前置**环境阻塞**（与 MP-02 同类，需用户侧扫码），**未伪造输出**。像素级视觉按用户本轮决策**不在范围内**。置 MP-03 状态为 submitted，待 Hermes 复跑验收。

---

## Evaluator 复跑评审（Hermes，2026-11-06）

**背景**：MP-03 CC（续接会话，撞 60 轮上限退出，exit 1）已完成收尾——2 commit（5f0e27a 数据/逻辑层、cb02ec9 UI 骨架）+ sprint_output + 置 submitted。正是 skill 预期的"撞轮次但已完成"形态，Hermes 直接复跑验收。

### Verify 逐条独立复跑

| # | verify 项 | 命令 | 结果 |
|---|---|---|---|
| 1 | 构建 0 报错 | `npm run build:mp-weixin` | exit 0 `DONE Build complete` |
| 2 | vitest 全套 | `npx vitest run` | exit 0，**10 files / 63 tests passed**（含本轮 31 用例：debounce 4 / searchHistory 10 / useProductList 11 / productApi 6） |
| 3 | 后端契约实测 | curl /wxapi/* | products.total=7；categories 裸 list count=7；keyword「卷绵」.total=1 命中「卷绵时代·舒卷床垫」 |
| 4 | e2e 脚本 | `node --check` + 实跑 | 语法 OK；后端基准步 [0] 断言通过（products/categories/keyword 三段齐）；UI 断言因开发者工具登录前置阻塞，未伪造输出 |
| 5 | 分类交接一致性 | grep pages/index/index.vue + list.vue onShow | filterStore.requestCategory ↔ requestedCategoryId 闭环 ✓ |

### 补充核查

- **范围守护合规**：未动 backend/、未提交 AGENTS.md/tasks.json、未触碰用户 untracked 文件；选品全程 Pinia（核心约定 9），搜索历史例外已注明并合理（属页面偏好非选品数据）
- **契约忠实**：SORT_TABS 映射仅传 BE-05 实际支持的 comprehensive/newest（推荐回退综合），productApi.test.ts 断言锁定；home.auto.js 向后兼容修正仅改 e2e 脚本未动 MP-02 源码
- **无死链设计**：MP-04/MP-05 未落地，卡片点击/OK 均 fail 回退 toast + 保留状态

### 遗留

1. **e2e 浏览器走查未完成**（环境阻塞，需用户侧开发者工具扫码）——build 绿 + 63 单测 + 后端可达已覆盖主要逻辑风险，浏览器断言待用户扫码后补跑
2. **视觉为功能骨架**（本轮用户决策），像素级还原待设计图确认后另派
3. 推荐排序后端无独立值，回退 comprehensive（CC 已在 sprint_output §2.3 说明）

### 结论

**approved**。功能骨架完整（搜索防抖+历史/侧分类/排序/宫格列表双视图/选品卡+底部栏/Pinia 接线/分页竞态防护），build 0 报错 + 63 单测全绿 + 后端契约实测吻合。e2e 浏览器断言受环境阻塞（诚实未伪造），不阻塞代码通过。MP-03 置 done。
