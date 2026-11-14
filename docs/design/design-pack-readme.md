# 乐卡思 LEKASI 床垫选品小程序 · 设计基线物料包（V3）

> ## ✅ 给 CC（Claude Code）的第一句话
>
> **本目录是 mattress-ux 的 UI 还原基线。**
>
> - 本项目品牌为 **LEKASI 乐卡思**，品牌视觉以此稿为准（`docs/CONVENTIONS.md` 第 36–42 行已明文确认：Figma ds 取 yellow `#F7C400` + navy，**取代** `aaa.md` §3.1.2 早期品牌金 `#D4A574`）。
> - 还原依据顺序：本目录 `design-spec/spec.md`（逐页精确规格）→ `design-spec/design-tokens.md`（token 真值）→ `references/*.png`（10 张视觉基线）。
> - `aaa.md` / `docs/design/design-brief.md` / `docs/design/figma-handoff.md` 中出现的「宝顿」「品牌金 #D4A574」「7 大分类（花筑手作/卷绵时代/小斑马…）」均为 **V2.0 旧记录，已被本稿取代**，不要再按它们实现。
> - 开发前先读 `open-questions.md`：13 条疑问已按「先做、后优化」存档，其中 5 条实现约定必须在本轮就做对（TabBar variant / 按钮 variant / 选品页取整 / 跳过版本条 / 热区先行）。

> **本目录仅为设计基线，不含任何实现代码。** 技术栈、目录结构、组件复用、TS/Lint 约束一律遵循仓库根 `CLAUDE.md` 与 `AGENTS.md`，本物料不做规定。

## 项目归属（已核实：就是本项目，V3 设计基线）

本物料包安装位置：`~/own/mattress-ux/docs/design/`

- 目标仓库 `~/own/mattress-ux/` = **床垫选品方案小程序**，品牌 **LEKASI 乐卡思**（`miniprogram/src/pages.json` → `navigationBarTitleText: "乐卡思 LEKASI"`，`pages/index/index.vue` 品牌名与文案均为 LEKASI）。
- 品牌视觉权威：`docs/CONVENTIONS.md` 第 36–42 行 —— 色板 `#1A2260 / #111639 / #F7C400 / #FFF8E1 / #FDFBF5 / #E7EAF6 / #8890B8`，并明写 **「取代 aaa.md §3.1.2 早期品牌金 #D4A574，品牌视觉以 LEKASI 设计稿为准」**。
- 本物料（V3）即该 LEKASI 设计稿的规格提取，**是 UI 还原基线**。
- ⚠️ `aaa.md` / `docs/design/design-brief.md` / `docs/design/figma-handoff.md` 中的「宝顿」「#D4A574」「7 大分类（花筑手作/卷绵时代/小斑马…）」为 V2.0 旧记录，本稿已取代，勿按旧记录实现。

## 基本信息

| 项 | 值 |
|---|---|
| 页面名称 | 乐卡思 LEKASI · 床垫选品小程序 |
| Figma 链接 | https://www.figma.com/design/hTG5vF6qoIYrY6gJM6N4F9/ |
| File Key | `hTG5vF6qoIYrY6gJM6N4F9` |
| 页面节点 | `86:538`（Page 4） |
| 画板数 | 10 个 Frame |
| 画板基准 | 375px 宽（内容高度自适应，844 为设计基准视口） |
| 物料生成时间 | 2026-11-14 |
| 版本标识 | 每页含 `V3 · 参考复刻优化版` 内部标识条，**上线前必须移除** |
| 提取工具 | Figma MCP：`get_metadata` / `get_screenshot` / `get_design_context` / `get_variable_defs` |

## 物料清单

```
doc/design/
├── README.md                        # 本文件
├── figma-source.txt                 # 原始链接与主 Frame 清单
├── open-questions.md                # ✅ 疑问存档：13 条，不阻塞开发，完成后优化
├── for-developer.md                 # ✅ 核心：开发还原读取顺序与约束
├── design-spec/
│   ├── spec.md                      # 页面目标、逐页规格、交互清单、歧义待确认
│   ├── design-tokens.md             # 现有设计令牌全表（实测值）
│   └── asset-inventory.md           # 图标 / 位图 / 插图资源清单
├── references/                      # 10 张视觉对比基线图
│   ├── home.png
│   ├── product-category.png
│   ├── product-list.png
│   ├── product-detail.png
│   ├── plan-01-empty.png
│   ├── plan-02-picker.png
│   ├── plan-03-edit.png
│   ├── plan-04-list.png
│   ├── plan-05-preview-share.png
│   └── mine.png
└── acceptance/
    └── visual-checklist.md          # 纯视觉验收清单（无代码校验项）
```

## 快速导航

- **要开始开发** → 先读 `for-developer.md`
- **查色值/字号/间距** → `design-spec/design-tokens.md`
- **查某页有哪些区块、什么尺寸** → `design-spec/spec.md`
- **找图标和图片** → `design-spec/asset-inventory.md`
- **确认做完没有** → `acceptance/visual-checklist.md`

## ⚠️ 待确认问题已存档，不阻塞开发

全部 13 条疑问已归档至 **`open-questions.md`**，按「先按稿实现，完成后统一优化」的原则推进。

| 状态 | 数量 | 说明 |
|---|---|---|
| `DEFERRED` | 12 | 按稿实现，优化阶段处理 |
| `DECIDED` | 1 | Q12 版本标识条 —— 直接不实现 |
| `BLOCKED` | 0 | 无阻塞项 |

**开发时必须知道的 5 条**（详见 open-questions.md）：

1. **Q12 版本标识条不实现** —— `V3 · 参考复刻优化版` 共 10 处，是内部评审标记，直接跳过。
2. **Q1 两套 TabBar 做成同一组件的 variant** —— 三项版（首页/分类/我的）与两项版（产品页/详情页），优化阶段只改配置不改结构。
3. **Q3 三按钮做成可配 variant** —— `我的方案`/`保存`/`预览分享` 现在等权重，优化阶段调整主次。
4. **Q10/Q11 选品页按 375px 实现** —— 画板实际 381px（异常）；卡宽不硬编码 126.92px，改按容器自适应；字号取整（10/8/8）。
5. **Q13 热区先行** —— 小 `×`、`+`/`✓`、`分享`/`小程序码`、`了解更多` 视觉按稿，但透明热区扩到 ≥44×44。这是无障碍基线，不等优化阶段。

## 已识别但未在 Figma Variables 中登记的硬编码色值

| 值 | 出现位置 | 建议 |
|---|---|---|
| `#f4f6fa` | 搜索框底、产品列表底、方案列表底、添加产品卡、详情标签底 | 建议登记为 `color/fill` |
| `#fff3c4` | 「舒适睡感」标签底 | 建议登记为 `color/yellowSoft` |
| `#6b4e00` | 「舒适睡感」标签文字 | 建议登记为 `color/yellowDeep` |
| `#111639` | 「我的」页客服服务卡底 | 建议登记为 `color/navyDeep` |
| `rgba(26,34,96,0.06)` | 产品卡片投影 `0 4px 8px` | 建议登记为 `shadow/card` |
| `rgba(26,34,96,0.25)` | 详情页圆形选款按钮投影 `0 6px 8px` | 建议登记为 `shadow/fab` |
