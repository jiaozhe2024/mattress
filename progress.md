# 项目进度记录

> 每次 session 完成任务后在顶部追加，不删历史。格式：## [日期] [任务名]

---

## 2026-11-15 BE-11 补寝具三款 + MP-03B 产品页 验收通过（Hermes）

### BE-11 seed 补 9B/9D/9P（用户决策方案 1）
首页三个寝具入口按型号搜索，但 V3 八产品里没有这三款 → `keyword=9B` 返回 0 条。核实设计稿
（`references/home.png`）确认它们是**产品型号入口**（大号型号数字+产品名），不是分类，
故补 seed 而非改交互。

- 新增 3 款归「次卧 · 不次等」（软床/枕头多用于次卧，八分类中语义最近），型号码 LEKASI-9B/9D/9P-180
- 产品总数 8→11；分布：次卧 · 不次等 4 款、其余各 1 款
- 测试断言同步 6 处（8→11、分页 3+3+2→3+3+3+2、下架后 10、spec 搜索 11、产品名集合、admin 列表）
- 实测：keyword=9B/9D/9P 各命中 1 条；**pytest 138 passed exit 0**
- commit `2775d66`

### MP-03B 产品页 V3 重写（CC 挂死，Hermes 接手）
CC 会话 `proc_124b8be7a0f5` **跑满 8 小时挂死**（CPU 20s 仅 +0.2s、15 分钟零写入），
代码已写完未提交。kill 后接手补完。

| 交付 | 内容 |
|---|---|
| `pages/product/list.vue` | 636 行重写：WechatNav 二级 + 搜索区 + 排序行 + 2 列网格 + 四态 + 触底加载 + TabBar two |
| `components/product/ProductCard.vue` | V3 卡片 167×246 / radius12 / 主图150 / 内容区 top156 143×82 / 标签 72×22 & 58×20 |
| `productListModel.ts` | 纯逻辑抽出 + 27 单测 |
| `scripts/e2e/product-list.auto.js` | 重写为双段（静态 20 项 + 动态 automator） |

**V3 三大移除项已清**：左侧分类侧栏、底部已选栏、列表视图产物（Q6 保留图标可点仍网格）

### Hermes 独立复跑
- `npx vitest run` → **280 passed / 23 files**（MP-03A 基线 253，+27）
- `npm run build:mp-weixin` → DONE 0 err
- 本轮 6 文件：**hex=0 / 裸间距=0 / 裸行高=0**
- e2e 静态段 **20 PASS / 0 FAIL**；动态段 automator 端口阻塞（`please make sure http port is open`），如实记录
- 规格逐条对照 spec.md §5.3 全部吻合

### Hermes 主动整改
补 token：`$space-28`（TabBar 左右 padding）、`$space-fab-bottom`（90px FAB 避让）、
`$line-height-16-fixed` / `$line-height-15-line`（3 处裸行高）。CC 自己已补
`$space-7/$space-9/$space-34`。全站本轮文件裸值清零。

### 遗留
1. automator 动态走查仍阻塞（开发者工具需扫码+开服务端口）
2. 产品详情页未建 → 卡片点击 toast 兜底，MP-04 建页后自动生效
3. **V2.0 遗留页面仍有硬编码 hex**（本轮范围外）：`article/list.vue`(9) / `article/detail.vue`(8)
   / `user/index.vue`(3, MP-06 会重写) / `webview/index.vue`(1) / `SelectedBar.vue`(7, MP-05A 会重写)
4. **CC 挂死频发**：MP-03A(63min)、MP-03B(8h) 连续两次「代码写完、收尾卡住」。
   看门狗 CPU 判定正确但 cron 15 分钟粒度滞后。后续派活应强化「先 commit 再写文档」。

---

## 2026-11-14 MP-03A 产品分类列表页 验收通过（Hermes 接手补完）

CC 会话 `proc_55cc63efd90a` 在收尾阶段挂死（63 分钟，CPU 15s 仅 +0.11s、10 分钟零写入），代码已写完但未写 sprint-output、未 commit。**Hermes kill 后接手补完，未重派不重做。**

| 交付 | 内容 |
|---|---|
| `pages/product/category.vue` | 333 行：系列横幅（navy/radius12/p18/gap6 + h120 图）+ 8 分类入口（h90/radius8/px20/gap12，双通道） |
| `components/category/categoryModel.ts` | 横幅常量 + `categoryEntryViewsOf` 双通道降级 + `productListUrlOf` |
| `static/category/banner-mattress.png` | 从 references/product-category.png 裁切（37.9KB，待真实素材替换） |
| tab 归属 | `tabBar.list[1]` → `pages/product/category`；config 拆 `PRODUCT_LIST_TAB`(tab) 与 `PRODUCT_LIST_PAGE`(普通页) |
| `pages/product/list.vue` | 适配脱离 tabBar：navigateTo 带参 + WechatNav + onLoad 消费 query.category_id |

### Hermes 独立复跑
- `npx vitest run` → **253 passed / 21 files**（MP-02 基线 226，+27）
- `npm run type-check` → exit 0
- `npm run build:mp-weixin` → DONE 0 err
- pages.json 实测：tabBar `[0]index [1]product/category [2]user`，pages 数组同时含 list 与 category
- 硬编码 hex 色值 0 处；文案与 spec §5.2 逐字一致
- automator 动态段仍阻塞（开发者工具扫码+服务端口），未伪造

### Hermes 主动整改：token 间距阶梯缺失
核对时发现「硬编码色值 0 处」的检查**只覆盖了 hex，漏了裸数值间距**。实际全站有 2/3/5/6/10/18/20/60px 共 6 个文件写裸值——根因是 `design-tokens.md` 的间距节只列了布局级 4/8/12/16/24/32，V3 稿的组件内部微间距没进 token。

已补 `$space-2..60` 完整阶梯 + 同名 CSS 自定义属性，批量替换后**全站裸 px 间距清零**，253 测试 + build 复跑无回归。

**教训**：验收「无硬编码」不能只 grep hex，要同时扫 `gap|padding|margin` 的裸数值。

---

## 2026-11-14 MP-02 首页 V3 还原 验收通过（Hermes）

CC 派活 `proc_69d4cf83e08d`，跑 55 分钟自然结束（**未被看门狗误杀**——CPU 时间采样确认持续增长，验证了 `addf4cd` 修复生效）。6 个分步提交：

| commit | 内容 |
|---|---|
| `8c8ad68` | `homeModel.ts` 内容模型 + 17 单测（静态文案/排序截断/双通道/指示点） |
| `ead9a7f` | `frame/SelectFab.vue` 胶囊 64×42，删 MP-01 圆形 FAB + main.ts 全局注册，5 单测 |
| `4b0b1e9` | `WxCategory` 补 subtitle/banner_image；filter store 加 requestedKeyword（与分类互斥），5 单测 |
| `4b0a9b7` | `pages/index/index.vue` 整块重写（旧 V2 结构全删），19 单测 |
| `33a71a4` | `product/list.vue` 消费关键词请求（回填搜索框+历史+检索） |
| `d75bf2e` | e2e 按 V3 重写 + sprint-output |

### Hermes 独立复跑
- `npx vitest run` → **226 passed / 19 files**（基线 183，+43）
- `npm run type-check` → **exit 0**
- `npm run build:mp-weixin` → **DONE Build complete**
- **硬编码色值 0 处、token 变量引用 69 处** —— MP-07 踩过的坑这次没重犯
- 逐区块比对 spec.md §5.1：主视觉（radius-16/navy/px24 pt24 pb16/gap8/Inter Bold 13 yellow 字距2/Bold 30 行高1.25）、系列卡（h76/radius-8/gap5 两列）、寝具卡（h90/radius-8）、SelectFab（64×42/radius-20/yellow）全部吻合
- 文案与 `homeModel.ts` 常量逐字对照 spec，一致
- Q14（轮播保留，仅1张隐藏指示点）、Q15（banner_image 优先/文字降级 + 加载失败兜底）均已落实
- e2e automator 段 **exit 124 超时**（开发者工具需扫码+服务端口），与 CC 报告一致，未伪造

### 遗留（记入后续任务）
1. **seed 无 9B/9D/9P 产品**：`keyword=9B` 返回 0 条。链路正确（Pinia→回填→检索），需后端补型号数据或确认检索口径
2. 图片 404（`/uploads/demo/*` 未上传），页面走占位层，素材补齐后无需改码
3. 服务卡 image 为空串、客服 corpId 为占位，待运营回填
4. SelectFab 用 `fixed`（设计稿写 absolute），为保持滚动常驻；CC 已在 sprint-output 说明
5. **轻微性能点**：`product/list.vue` onShow 切分类时 `void search("")` 与 `setCategory()` 并发触发两次 reload，有 `requestSeq` 兜底不影响正确性，MP-03B 重写时一并整理

---

## 2026-11-14 V3 设计基线落地启动 + BE-10 验收通过（Hermes）

**背景**：用户更新设计文档，`docs/design/` 新增 LEKASI V3 基线包（10 张 `references/*.png` + `spec.md` + `design-tokens.md` + `open-questions.md` + `visual-checklist.md`）。V3 与既有实现结构冲突，用户 2026-11-14 决策如下：

| 决策 | 结论 |
|---|---|
| MP-02/MP-03 返工 | 全部按 V3 重做，先全局层再逐页 |
| 分类数据 | 改 seed 为 V3 八分类（非 8 个以外） |
| 首页轮播 | **保留**（覆盖 spec.md §8「不实现轮播」该条） |
| 导航实现 | 全站 navigationStyle=custom，只自绘 44px 标题导航，状态栏/胶囊交系统 |
| 分类副文案 | 文字 + 图片双通道，接口都返回，**有图优先显示图、无图降级文字**（本轮 banner_image 全 null） |
| 寝具 3 入口 | 非独立分类，点击跳产品页按型号搜索（keyword 9B/9D/9P） |
| 派发节奏 | 先 BE-10 + MP-07 → MP-02 → 验收后再逐页 |

**tasks.json 全套重排**（24 个任务）：
- 取消：MP-03（把分类列表与产品页混为一页）、MP-05（缺独立选品页）→ 注明承接方
- 新增：BE-10（分类双通道字段 + V3 seed）、MP-07（V3 全局复用层）
- 拆分：MP-03A/03B、MP-05A/B/C/D
- 返工：MP-02、MP-06

**文档同步**：DB_SCHEMA.md 第 1 节（subtitle/banner_image + 渲染规则）、open-questions.md 新增 Q14/Q15、AGENTS.md 约定 6 补读清单并明确 jp/ 作废、新建 jp/README.md 标注为 V2.0 旧稿存档。

### BE-10 验收通过（Hermes 独立复跑，全部实测）
- commit `0f15b17`；迁移 `be10cat2f7a1` 挂 `a3f7c9d21e05` 之后，MySQL 实测 `subtitle varchar(100) NULL` + `banner_image varchar(255) NULL` 两列存在
- `curl /wxapi/categories` = 8 条，sort 1..8 与定稿逐条一致，8 条 subtitle 非空、banner_image 全 null
- `curl /wxapi/products?size=50` = 8 条，category_name 覆盖八分类全集，spec 全 `1800 × 2000 mm`，sleep_feel 全 `舒适睡感`
- `curl /wxapi/home` categories=8 且带两字段
- pytest `138 passed, 1 skipped`（skip 为基座 sensitive-word 既有）
- **干净库隔离验证**：删 test.db 后单跑 wxapi_content 26 / admin_content 28 / business_models 6 全绿 → 证明 BE-06 记录的 sqlite 索引撞名技术债确实已修（CC 显式命名 `ix_gin_product_category_fk`）
- CC 顺手修正两处过期测试夹具（品牌电话 4008001234、旧型号名），均为测试层，未动业务逻辑
- **我方描述瑕疵**：我给 CC 的指令写「subtitle 用全角空格分隔两段」，但分类 5/6/7 定稿本就单段；CC 按定稿值落库、只对 1/2/3/4/8 校验全角空格，处理正确
- **遗留**：Admin 分类页浏览器交互走查（填副文案/点上传/缩略图）未做，build 与 API 链路已通；8 条 banner_image 待设计出图后由 Admin 上传

MP-07 同期并行执行中（前端 CC，只 add miniprogram/ 避免 git 冲突）。

### MP-07 验收通过（Hermes 接手补完）
- **CC 被 cc-watchdog 判挂死 SIGKILL**（`[14:50:08] KILL pid=18952 etime=01:00:04`）——跑满 60 分钟触发看门狗阈值。但**代码实际已写完**，只差 sprint-output 与 commit。Hermes 接手补完。
- commit `abb35a4`；183 tests passed（新增 6 文件 99 用例）；build 0 error
- 交付：`tokens.scss`（15 色/2 投影/11 圆角/16 档字号配行高/6 间距，只声明变量不输出 CSS 规则）、`WechatNav`（h44，一级 LEKASI / 二级返回，热区 44×44）、`SafeArea`（`max(22px, env(safe-area-inset-bottom))`）、`TabBar`（three/two 同一组件 variant，Q1 决议）、`Icon.vue`（15 个内联 SVG，不引第三方包）、`navLayout.ts`（胶囊反推 + 双 API try/catch + 兜底 44+32 + fallback 标记）
- pages.json 全站 7 页 `navigationStyle=custom`、`tabBar.custom=true`、custom-tab-bar 四件套 + 6 张图标
- **Hermes 修正 CC 遗留违例**：4 个全局组件把色值/字体族硬编码在 `<style>` 里未引 token（违反 tokens.scss 自己的「页面层禁止自定义色值」），已全部改为 `$color-*` / `$font-*` / `$radius-*`；Icon 的 color prop 等 JS 运行时值属合理例外保留
- **遗留 1**：automator 动态走查被微信开发者工具扫码+服务端口前置阻塞（exit 124 超时），静态断言 4/4 过；像素级截图比对同待解锁
- **遗留 2**：`pages/frame/preview` 是自建校验临时页，**上线前应删除**
- **遗留 3**：TabBar `two` 版暂无页面使用，等 MP-03B / MP-04 落地验证
- **看门狗副作用提示**：60 分钟阈值对"大任务收尾阶段"偏激进（本次代码已完成却被杀）。后续派大任务时应在任务描述里要求 CC 尽早 commit，或临时调高 `STALE_MIN`

---

## 2026-11-14 BE-10 分类副文案字段 + V3 演示数据重写（LEKASI 八分类）（submitted，待验收）
- `gin_product_category` 增 `subtitle VARCHAR(100) NULL` + `banner_image VARCHAR(255) NULL`（alembic `be10cat2f7a1`，down_revision `a3f7c9d21e05`）；Q15 双通道：有图优先 banner_image，无图降级 name+subtitle
- 贯通：admin_content（Create/Update/Out）+ wx_content（WxCategoryOut）+ 两个 service 的 `_category_out`；`PRESET_CATEGORY_NAMES` 派生自 DEMO_CATEGORIES 自动变 8 条（仅注释/错误文案 7 大→8 大）
- Admin `views/category/index.vue`：表格加「入口图」缩略图列 + 「副文案」列；弹窗加 subtitle 输入（max 100）+ banner_image ImageUpload（复用 BE-08 上传）；`npm run build` RC 0
- demo_seed 重写：V3 八分类（sort 1..8，subtitle 全角空格两段；5/6/7 定稿为单段；banner_image 全 null）+ 八产品一分类一款（3D床垫/幸福3号/幸福2号/幸福1号/幸福99床垫/505压缩卷包床垫/323特制版床垫/9M 卷绵特制床垫，型号 LEKASI-*-180，spec 1800 × 2000 mm，sleep_feel 舒适睡感）；幂等逻辑（分类非空即跳过）不变
- **顺手修 BE-06 技术债**：`gin_product.category_id` 改 `Column(BigInteger, ForeignKey)` + `__table_args__=(Index("ix_gin_product_category_fk","category_id"),)`——SQLite 干净库索引名撞名（verify 要求 `rm test.db` 单跑分类测试通过；MySQL 表级隔离无感，无新迁移）
- 验收：alembic head=be10cat2f7a1；MySQL SHOW COLUMNS 两列齐 + 分类/产品各 8；curl /wxapi/categories 8 条 subtitle 非空 banner_image=null sort 1..8、/wxapi/products?size=50 total=8 全落八分类、/wxapi/home categories=8 含两字段；admin 上传 banner_image→PUT→wxapi 同步→复原 null 闭环实测；pytest 全量 **139 tests / 0 fail / 1 skip（基座既有）**；干净库单跑 4 文件 26/28/6/34 全绿
- 发现：BE-08 遗留断言 `400-800-1234` 与 seed 纯数字不符（已改 `4008001234`）；test_wxapi_schemes 旧型号 JM-SJ-001/9M-ZX-180 已换 LEKASI-505-180/LEKASI-3D-180
- 数据重建：备份 `/tmp/be10_backup_before_reseed.sql` → 7 张 gin_ 演示表 TRUNCATE（不动 wx_user/基座表）→ seed 脚本 → `docker compose up -d --build web`
- 详情 docs/exec-plans/active/BE-10-sprint-output.md；tasks.json BE-10 **未动、未 commit**（Hermes 所有权）

## 2026-11-06 MP-03 产品列表页功能骨架（续接中断 session）（submitted，待验收）
- 用户决策本轮：功能骨架优先（逻辑/数据/交互完整，**不做** jp 图像素级视觉还原，视觉精修后续另派）
- **续接**上一中断会话的未提交文件（先读后接，未推倒重写）：list.vue / api/product.ts / composables/useProductList.ts / components/product/{ProductCard,SelectedBar}.vue / utils/{debounce,searchHistory}.ts / config.ts(+SCHEME_EDIT_PAGE) / types/product.ts(+WxProductListItem/WxProductPage)
- 本 session 新增：4 单测文件（31 用例）、e2e product-list.auto.js、home.auto.js 向后兼容修正、MP-03-sprint-output.md
- 功能：GET /wxapi/products 分页(size=10,≤50)+category_id+keyword(300ms 防抖)+sort；竞态防护(requestSeq)；loading/ready/error/empty 四态；触底 loadMore；分类侧边导航(onShow 经 useProductFilterStore 接首页 jump_type=2/宫格传参,核心约定9)；排序 Tab 综合/推荐/新品；宫格⇄列表视图切换；产品卡「+」调 useSelectionStore.addProduct(去重,已选置灰✓)；底部已选栏(数量+横滚缩略图+移除+OK)；搜索历史 10 条本地存储(约定9 例外:历史属页面偏好非选品数据)
- 排序契约：BE-05 ProductSort 仅 comprehensive/newest，无独立推荐；「推荐」Tab 回退 comprehensive(仅改 api/product.ts SORT_TABS 映射表即可扩展)
- OK 跳转：/pages/scheme/edit(MP-05,未建)→navigateTo fail 回退 toast 并保留 Pinia 选品；卡片点击→/pages/product/detail(MP-04,未建)同样回退,不留死链
- 验收：`npm run build:mp-weixin` 0 errors；`npx vitest run` **10 files/63 passed**(本轮 +31)；后端可达 products.total=7/categories=7/keyword「卷绵」=1；e2e product-list.auto.js 第[0]步后端基准通过
- **遗留风险**：e2e 浏览器走查环境阻塞——`automator.launch` 挂起 >140s(微信开发者工具需扫码登录+开服务端口,与 MP-02 同类)，**未伪造 e2e 输出**，需用户侧扫码后复跑；视觉为骨架非像素还原(本轮范围外)；推荐排序为回退
- home.auto.js 兼容修正：MP-02 断言[3]原查 `.pending-category` 占位,MP-03 起列表为真实页,改查 `.pl-side-item--active` 高亮=jump_value 对应分类名(**仅改 e2e 脚本,未动 MP-02 页面源码**)
- 范围守护：未动 backend/、AGENTS.md；tasks.json 仅改 MP-03→submitted(**不 commit**,Hermes 所有权)；未 stage 并发 BE-08 改动的 demo_seed.py/BE-08-sprint-output.md/tech-debt-tracker.md/docs/CONVENTIONS.md(MP-02 遗留)；未碰 jp/、figma-exports/、CLAUDE.md、部署.md
- 详情 docs/exec-plans/active/MP-03-sprint-output.md

## 2026-11-06 BE-08 Admin 内容管理前端收尾（接续 session）（submitted，待验收）
- 前序已交付：后端 5 模块 CRUD API+OSS 适配层+27 用例全绿（b66f7cc/41fcebb/549a118）；前端基建+轮播+分类（16ae3df/f634ed7/d0e43c7）
- 本 session 3 commit 补齐前端：**fff8342 产品管理**（接续未提交 views/product/index.vue：筛选分页列表 分类/名称/型号/状态、完整编辑表单=基础信息+主图单传+详情轮播图≤10+实拍图≤20+wangEditor 富文本+上下架开关、批量上下架）；**72c98d3 资讯与服务管理**（news/service 分类筛选+标题 LIKE+状态、编辑弹窗=标题/分类 radio/封面/wangEditor/发布开关、软删除带确认）；**831ea13 品牌信息配置**（单页表单=介绍 textarea/加盟电话前端校验 ^\d{6,20}$ 与后端一致/客服承诺可增删行 ≤20 条提交过滤空白/门店图多传 ≤20、GET null 首存提示）
- 路由菜单：五模块全挂 /content 下，meta.rbacPath=/content/banner|category|product|article|brand 与后端 init_content_menus 种子对齐，走 BE-03 RBAC 过滤
- 验收：backend/admin `npm run build`（vue-tsc+vite）0 errors；登录 admin 后 curl 五模块 list 端点全 code=200 且 shape 与 types/content.ts 逐字段一致（banners 2 条/categories 7 条/products 分页含 category_name/articles 列表 content=null 编辑走详情/brand 单行 seed）
- 遗留风险：seed join_phone=400-800-1234 含连字符与后端纯数字校验冲突（保存品牌页需先改为纯数字，建议记 tech-debt）；主 chunk >500kB 体积 warning（wangEditor+ElementPlus，可后续 manualChunks）；浏览器交互走查留 Hermes（npm run dev）
- 详情 docs/exec-plans/active/BE-08-sprint-output.md；tasks.json BE-08 → submitted（未 commit，Hermes 所有权）

## 2026-11-05 BE-06 wxapi 方案 CRUD+快照+分享（V2.0 核心）（submitted，待验收）
- 7 端点挂 /api/v1/wxapi/schemes*：POST 创建（单事务固化快照，产品缺失 404 整体回滚）、PUT 整体替换（删旧快照行按产品当前状态重新固化）、GET 列表（本人 create_time desc 分页 size≤50，软删除不出现）、GET 详情（含快照列表）、GET /{id}/public（匿名回显，出参 Schema 物理无 user_id/openid，仅 nickname 展示字段）、DELETE 软删除（gin_scheme.deleted_at 新列 + alembic 迁移 a3f7c9d21e05，行/快照保留供 BE-09）、POST /{id}/share（SQL 原子自增）；越权一律 403，不存在/已删 404
- 快照冻结 12 字段（aaa.md §4.3.1）：id/category_id/category_name/name/model/slogan/spec/sleep_feel/main_image/detail_images/real_images/detail_content；product_ids 去重保序 → sort=0..n-1；核心不变量测试：产品改名/改规格后旧方案 owner+public 双通道仍为快照旧值
- 分层新增：schemas/wx_scheme.py + repositories/wx_scheme.py + services/wx_scheme_service.py + api/v1/wxapi/schemes.py（域异常 SchemeNotFound/Permission/SnapshotProductNotFound → 路由层 404/403）；models/scheme.py 加 deleted_at；未动 BE-04/BE-05/admin 代码
- 验收：tests/test_wxapi_schemes.py 34 用例绿（全套 109 passed 1 skipped）；web 容器重建 + alembic upgrade head 后 curl 闭环实测（登录→建→查→public 无敏感字段→share x2 计数 1→2→列表→删→列表空/详情 404/public 404），MySQL 复核 deleted_at 置位且快照行保留；注意本地跑 pytest 前需 rm backend/test.db（sqlite create_all 不 ALTER 旧表）
- 遗留风险：容器迁移为手动步骤（entrypoint 不跑 alembic）；软删除刻意不清快照行（硬删 CASCADE 已备）；PUT 无乐观锁，并发后写覆盖；创建方案不筛上下架（快照语义优先）
- 详情 docs/exec-plans/active/BE-06-sprint-output.md；tasks.json BE-06 → submitted（未 commit，Hermes 所有权）；BE-07 已被用户决策推迟 V2.1

## 2026-11-06 BE-06 验收通过 + MP-02 验收通过 + BE-08 后端完成（Hermes）
- **BE-06 验收通过置 done**（Hermes 独立复跑 7 项 verify 全过）：pytest 全量 REAL exit=0（109 passed）；curl 闭环（创建→详情→public 匿名无 openid/user_id→share 1→2→软删后列表空/public 404→无 token PUT 401）；**快照不可变实测**：改 gin_product.name 后再查方案快照仍是旧值
  - **验收中发现技术债务（BE-02 遗留）**：sqlite 测试库索引名撞名 `ix_gin_product_category_id`（gin_product.category_id vs gin_product_category.id 同名索引，SQLite 索引名库级全局唯一必撞）→ `rm test.db` 后单独跑测试 34 条全 ERROR；MySQL 索引名表级隔离不受影响。修法：去掉 BaseModel.id 冗余 index=True 或 category_id 显式命名。已记入 docs/exec-plans/tech-debt-tracker.md（优先级:中）
- **MP-02 首页**（CC 撞轮次，代码完整提交 8ab9400，Hermes 补 sprint_output + 置 done）：npm run build:mp-weixin DONE 0 报错；/wxapi/home 聚合可达（banners=2 categories=7 services=1）；swiper 轮播/jump_type 1~4 分发/7 分类宫格/scroll-view 服务横滚/Pinia 传分类/悬浮选款回退全在；**e2e 浏览器走查被开发者工具登录前置阻塞**（automator 需扫码+开服务端口，用户侧操作，待补跑）
- **BE-08 Admin 内容 CRUD**（CC 撞轮次，后端 3 commit 完成：b66f7cc OSS 适配层+/uploads 静态挂载、41fcebb 5 模块 CRUD API、549a118 27 用例全绿；**前端 5 个业务页面未做**，仅装了 wangEditor 依赖）；tasks.json 仍 pending → **待重派 CC 补前端**
- 详情：docs/exec-plans/active/MP-02-sprint-output.md；BE-08 sprint_output 待前端完成后由 CC 或 Hermes 补

## 2026-11-05 BE-05 wxapi 产品/首页聚合/资讯/品牌接口（submitted，待验收）
- 新增 7 个匿名只读 GET（/api/v1/wxapi/*）：home 聚合（banners+categories+services）、categories、products 列表（page/size≤50、category_id、keyword、sort=comprehensive|newest）、products/{id} 详情（富文本+detail_images/real_images JSON，下架 404）、articles 列表（可过滤 news/service）、articles/{id}（下线 404）、brand 单行配置
- 分层：repositories/wx_content.py（关键词搜索用 SQLAlchemy contains(autoescape=True) LIKE 封装 name/model/slogan/spec，无裸拼 SQL，核心约定 #3）→ services/wx_content_service.py → api/v1/wxapi/content.py；信封 {code,msg,data}，分页 data={items,total,page,size}，时间字段对外 create_time
- 契约决策：文章 category 枚举=news/service（models/enums.py ArticleCategory）；/home services=category='service' 且已发布；/brand 无数据 200+data=null；文章列表不返回富文本
- 未动 BE-04 auth 代码（wxapi/__init__.py 仅追加挂载 2 行）；复用 BE-02 模型与 demo_seed，无新表/迁移
- 验收：tests/test_wxapi_content.py 24 用例绿（全量绿，1 skipped 为基座 sensitive-word 依赖遗留）；web 容器重建后 curl 全部实测通过，含 dev 库临时下架 JM-SJ-001 → 列表 total 7→6 + 详情 404 + 恢复 200（详见 docs/exec-plans/active/BE-05-sprint-output.md）
- 遗留风险：/home 无缓存（3 次查询/请求）；%kw% LIKE 不走索引（<10 万约定内）；匿名接口未单独限流；web 容器无源码挂载需重建部署
- 详情 docs/exec-plans/active/BE-05-sprint-output.md；tasks.json BE-05 → submitted；下次：Hermes 复跑验收，MP-02/03/04/06 的 BE-05 依赖已就绪

## 2026-11-05 BE-04 wxapi 登录与用户体系（submitted，待验收）
- 新建 /api/v1/wxapi/* 路由组（与 admin 路由组物理隔离）：POST /auth/login（wx.login code → code2session → 查/建 wx_user → 7 天 token 对）、POST /auth/refresh、GET /users/me
- 独立 JWT 体系三重隔离：WX_JWT_SECRET_KEY 独立密钥 + payload（wx_user_id/scope=wxapi）+ token_type（wx_access/wx_refresh）；admin token 打 wxapi 与 wx token 打 admin 均 401（pytest+curl 双向实测）
- code2session 用 httpx.AsyncClient（异步红线），dev/测试 WX_CODE2SESSION_MOCK=true 固定 openid=mock_openid_wxtest_001，code=invalid_code 模拟 40029→401；生产校验强制关 mock + 配 WX_APPID/WX_SECRET + 覆盖密钥
- 分表红线：wx_user 仓储不 import models.admin；curl 实测登录只写 wx_user，后台 user 表计数不变；并发首登靠 openid 唯一索引 IntegrityError 回查兜底
- 验收：tests/test_wxapi_auth.py 12 用例绿，全量 50 passed/1 skipped；容器重建后 curl 7 项全过（详见 sprint-output）
- 遗留风险：mock 单 openid（BE-06 多用户需 repository 造数）；7 天 token 无吊销（禁用靠每请求 status 校验兜底）；/wxapi/auth/login 未挂限流
- 详情 docs/exec-plans/active/BE-04-sprint-output.md；tasks.json BE-04 → submitted；下次：Hermes 复跑验收，通过后可派 BE-05/BE-06（BE-06 blocked_by BE-04）

## 2026-11-05 BE-03 Admin 前端工程骨架（submitted，待验收）
- 新建 backend/admin/（Vite+Vue3+TS+Element Plus，无模板 vendor）：登录页对接基座 JWT、布局（侧边菜单+顶栏+面包屑）、路由守卫（无 token/401 跳登录）、RBAC 菜单级过滤（超管全放行；普通用户按角色 GET /role/authorized 菜单并集）、axios 统一封装（信封拆包/Bearer/错误 toast）
- 契约核验：登录成功 code200 含 access/refresh token；错密码 HTTP 400「密码错误!」；无效 token 401；dev 端口固定 8080（后端 CORS 白名单 3000/8080，3000 被占用）
- 验收：npm run build 绿；Playwright 浏览器 10 项全 PASS（无 token 跳转/错密码 toast/登录进布局/侧边栏面包屑/无效 token 清 token 回登录）；截图 /tmp/be03_dashboard.png
- 契约缺口记录：基座 /base/usermenu 被注释未启用（前端改用 role/authorized 求并集）；refresh 自动续签未做；token localStorage 明文（技术债）
- 详情 docs/exec-plans/active/BE-03-sprint-output.md；tasks.json BE-03 → submitted；下次：Hermes 复跑验收后派 BE-08/BE-09（依赖 BE-02）

## 2026-11-05 V2.0 全量重建（规格书驱动）
- 用户提供 aaa.md（技术需求规格说明书 V2.0）：产品转向 **B 端导购/经销商赋能工具**（产品展示 → 方案生成 → 微信分享），明确不做 C 端交易
- aaa.md 修正：小程序端选型由「微信原生+Vant Weapp」改回 **Uni-app+Vue3+TS+Pinia**（与仓库既有定稿一致，文档内部 Pinia/原生矛盾已消除）；同步修正 MySQL 理由（去 RuoYi 引用）、架构图、Admin 理由
- 全量重建地基（以 aaa.md V2.0 为唯一依据）：
  - 新增 docs/product-specs/PRD-v2.0.md（提炼规格）；PRD-v1.1 标记已废弃
  - TECH_DECISIONS / ARCHITECTURE / CONVENTIONS / QUALITY / business-solution / backlog / design-brief / figma-handoff 全部 V2.0 化
  - AGENTS.md 更新（权威规格=aaa.md；核心约定新增 方案快照 条款；去内容社区）
  - tasks.json 重排：数据模型 8 表（gin_product_category/gin_product/wx_user/gin_scheme/gin_scheme_product/gin_banner/gin_article/gin_brand_info）取代 V1.1 的 11 表；NG-01/BE-02~09 + MP-01~06 对齐 V2.0 页面（3 Tab 首页/产品/我的 + 方案中心编辑/列表/预览）；MP-02~06 blocked 等用户确认 jp/ 参考图
- 关键模型变更：商品无独立 SKU 表（规格内嵌字段）；「方案 Scheme + 快照 JSON」取代「选品单 wishlist」；移除内容社区（视频/内容带货不做）
- 下次从这里开始：派 CC 执行 NG-01（后端底座）与 MP-01（小程序骨架，不依赖设计稿）；BE-02 阻塞链 NG-01→BE-02→BE-04/05→BE-06→BE-07

## 2026-11-05 技术选型重定稿 + 旧基座清理 + 任务重排
- 决策：后端 FastAPI + **SQLModel** + MySQL8 + Redis（参考 JiayuXu0/FastAPI-Template 的分层/RBAC/JWT/arq，ORM 层自建，模板官方 Tortoise+PG 不采用）；管理后台 Vue3+Element Plus+Vite 由 CC 生成；小程序改 Uni-app+Vue3+TS+Pinia。依据：仓库根 技术选型.md
- 清理：backend/ RuoYi-FastAPI 旧基座 git 全量移除；ruoyi-* 四容器 + mysql/redis 卷 `docker compose down --volumes` 清空；backend/ 留占位 README
- tasks.json 重排：新增 NG-01（新基座初始化）；BE-01 → cancelled；BE-02 改 SQLModel/alembic；BE-03 改 Admin CC 生成；BE-07 附带 arq 海报队列；MP-01 改 Uni-app；MP-05 补参数对比
- 文档同步：TECH_DECISIONS / ARCHITECTURE / CONVENTIONS / PRD-v1.1 / QUALITY 全部去 RuoYi 化；AGENTS.md 技术栈与红线更新
- 下次从这里开始：派 CC 执行 NG-01（阻塞 BE-02）；或并行 MP-01（不依赖 Figma/后端）

## 2026-11-05 BE-01 后端基座初始化（RuoYi-FastAPI）
- RuoYi-FastAPI master 基座 2755 文件全量迁入 backend/（无嵌套 .git，sys_/gen_ 框架表原样，未建业务表）
- 新增 backend/docker-compose.yml（跟随上游 MySQL 版官方 compose，补 mysql/redis 持久化卷）
- 镜像构建修复：清华 pip 源本机 403 → 阿里云镜像；sqlglotc 30.23.0 仅 cp311+ 预编译轮 → 后端镜像升 Python 3.12（CI 同款），避免 25min Rust 源码编译后启动崩
- 四容器全部 Up（mysql/redis healthy）：admin 12580、api 19099、mysql 13306、redis 16379
- 验收探活全过：init.sh OK；/docker-api/captchaImage 返回 JSON；admin 登录页 200
- **端口要点：Docker 模式 API 前缀是 /docker-api（非 /dev-api，后者是本地 dev 模式）**，探活/集成测试统一用 /docker-api
- 输出：docs/exec-plans/active/BE-01-sprint-output.md；tasks.json BE-01 → submitted（待 Hermes 复跑验收）
- 下次从这里开始：Hermes 验收 BE-01；或并行开 BE-02（业务表，依赖 BE-01）/ MP-01（小程序骨架，不依赖 Figma）

## 2026-11-04 初始化 Harness（PRD V1.1 + 技术选型定稿）
- 完成 harness-step1/3：AGENTS.md、docs/ 知识库、init.sh、tasks.json、progress.md
- PRD 升级 V1.1：新增内容社区模块（图文/视频带货）；热词管理降级为 backlog
- 技术选型定稿：原生小程序+Vant Weapp / RuoYi-FastAPI 基座（详见 docs/TECH_DECISIONS.md）
- UI 流程：Designer 在 Figma 出稿（约定见 docs/design/figma-handoff.md），CC 按稿实现，Hermes 验收对照截图
- tasks.json 初始任务数：14（BE-01~07 后端线、MP-01~07 小程序线；MP-02~07 blocked 等 Figma 稿）
- 下次从这里开始：读 tasks.json，选 priority=high 且 status=pending 的任务（当前 BE-01 / MP-01），派 CC 执行，Hermes 当 Evaluator
- 待用户动作：① 微信开发者工具扫码登录一次（automator 验收前置） ② Designer Figma 稿交付 ③ 云服务器/域名预算确认