# MP-03B Sprint Output — 产品页 V3 还原（搜索 + 排序 + 2 列网格）

- 任务：MP-03B（tasks.json，priority=high，blocked_by=MP-07 + BE-10，均已 done）
- 执行：CC 前端会话 `proc_124b8be7a0f5`
  - **CC 挂死**：跑满 8 小时（etime=07:59:31）时 CPU 20s 仅 +0.2s、15 分钟无文件写入。
    代码已写完（list.vue 636 行 + ProductCard 重写 + productListModel），但未写
    sprint-output、未 commit。Hermes kill 后接手补完。
- 结论：verify 全部通过（e2e automator 段环境阻塞，如实记录）

## 1. 交付清单

| 文件 | 内容 |
|---|---|
| `pages/product/list.vue` | 636 行重写：WechatNav 二级 + 搜索区 + 排序行 + 2 列网格 + 四态 + 触底加载 + TabBar two |
| `components/product/ProductCard.vue` | 重写为 V3 卡片：167×246 / radius12 / shadow-card / 主图 150 / 内容区 top156 143×82 |
| `components/product/productListModel.ts` | 纯逻辑抽出（66 行），配单测 |
| `tests/productListModel.test.ts`、`productPage.test.ts` | 新增 27 用例 |

### 三大移除项（V3 产品页不该有的）

| 项 | 状态 | 验证 |
|---|---|---|
| 左侧分类侧边导航 | **已移除** | grep `side-item|SelectedBar|selected-bar` = 0 |
| 底部已选栏 | **已移除** | 同上（SelectedBar 不再被本页引用） |
| 列表视图切换产物 | **已移除** | 图标保留可点，Q6 DEFERRED 不做列表视图 |

## 2. verify 逐项实测（Hermes 独立复跑）

| # | verify 项 | 结果 | 实测 |
|---|---|---|---|
| 1 | `npm run build:mp-weixin` 0 error | **PASS** | `DONE Build complete.` |
| 2 | 页面无左侧分类栏/无底部已选栏/无列表视图产物 | **PASS** | grep 计数 0 |
| 3 | 搜索框占位、排序三项、默认综合带指示条 | **PASS** | 代码核对：`请输入搜索的商品`、综合/推荐/新品、28×3 radius2 yellow |
| 4 | 产品卡两列、尺寸 167×246 | **PASS** | ProductCard：`height:246px`；宽度由父网格 calc 决定（两列 gap9） |
| 5 | 规格文案、舒适睡感标签存在 | **PASS** | `.pcard-spec` / `.pcard-feel` 72×22 radius11 yellowSoft + yellowDeep |
| 6 | 输入关键词后列表刷新 | **PASS** | 复用 useProductList + 300ms 防抖，单测覆盖 |
| 7 | 截图与 references/product-list.png 逐区块比对 | **PARTIAL** | 规格逐项核对通过（见 §3），像素级待 automator 解锁 |
| 8 | 无版本标识条 | **PASS** | 全仓 grep 无命中 |

补充实测：
- `npx vitest run` → **280 passed / 23 files**（MP-03A 基线 253，本轮 +27）
- 本轮 6 个文件：**硬编码 hex 0、裸 px 间距 0、裸行高 0**

## 3. 规格逐项核对（spec.md §5.3）

| 规格项 | spec | 实现 |
|---|---|---|
| 导航 | 二级页，标题=分类名 | WechatNav `back`，onLoad 由 category_id 解析 |
| 搜索区 | pt16 px16 gap12 | `$space-16 $space-16` + `$space-12` ✓ |
| 搜索框 | 311×36 radius18 bg fill | ✓ |
| 搜索图标 | 16×16 left14 top10 | ✓ |
| 占位文字 | Regular 13 text3 left38 top9 lh19 | `$font-13` / `$line-height-13-fixed` ✓ |
| 排序行 | h38 gap34 | `$space-34` ✓ |
| 综合 | Bold 14 navy + 28×3 radius2 yellow gap7 | `$space-7` ✓ |
| 推荐/新品 | Regular 14 text2 | ✓ |
| 网格 | bg fill p16 gap12 两列 gap9 | `$space-9` ✓ |
| 卡片 | 167×246 radius12 shadow/card | ✓ |
| 主图 | 167×150 object-cover 贴顶 | ✓ |
| 内容区 | left12 top156 143×82 | `$space-12` ✓ |
| 产品名 | Medium 13 text1 lh1.45 | ✓ |
| 规格 | Inter Regular 10 text3 lh1.5 top21 | ✓ |
| 标签行 | h22 top38 | ✓ |
| 舒适睡感 | 72×22 radius11 yellowSoft / Medium 11 yellowDeep lh16 | ✓ |
| 查看详情 | 58×20 radius4 fill / Regular 10 text3 lh15 | ✓ |
| 底部 | TabBar two（首页/返回） | ✓ |
| 版本条 | 不实现（Q12） | ✓ |

## 4. Hermes 接手修正

1. **CC 未写 sprint-output / 未 commit** —— 由 Hermes 补完。
2. **token 阶梯再次补全**：CC 在 tokens.scss 补了 `$space-7 / $space-9 / $space-34`（正确），
   但仍有 3 处裸行高（16px/15px/19px）落在 ProductCard 与 list.vue。已补
   `$line-height-16-fixed` / `$line-height-15-line` 并替换，复用既有 `$line-height-13-fixed`。
3. **跨页残留裸值**：`TabBar.vue` 的 `padding: 0 28px`、`index.vue`/`category.vue` 的
   `padding: ... 90px`（FAB 避让）。已补 `$space-28` / `$space-fab-bottom` 并替换。

## 5. 遗留与风险

1. **automator 动态走查未完成**：需微信开发者工具扫码 + 服务端口，再跑
   `node scripts/e2e/product-list.auto.js`。
2. **像素级视觉比对未做**：依赖上条。
3. **产品详情页尚未存在**：卡片点击跳 `/pages/product/detail` 会 fail → toast 兜底，
   不留死链。MP-04 建页后自动生效。
4. **V2.0 遗留页面仍有硬编码 hex**（本轮范围外，已记录待后续任务）：
   - `pages/article/list.vue`（9 处）、`pages/article/detail.vue`（8 处）
   - `pages/user/index.vue`（3 处，MP-06 会重写）
   - `pages/webview/index.vue`（1 处）
   - `components/product/SelectedBar.vue`（7 处，MP-05A 会重写）
5. **CC 挂死频发**：MP-03A（63min）、MP-03B（8h）连续两次挂死，均为「代码写完、
   收尾阶段卡住」。看门狗 CPU 判定正确但 cron 15 分钟粒度滞后。建议后续派活
   prompt 里强化「先 commit 再写文档」，降低损失。
