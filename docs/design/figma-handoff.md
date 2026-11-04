# Figma 设计交付约定（Designer → CC → Hermes）

## Designer 交付物（每批设计稿）
1. Figma 文件链接（开启 Dev Mode 权限，CC 与 Hermes 可读）
2. 设计 token：一份 JSON/表格，包含色板（primary/success/warning/danger/neutral 灰阶）、字号梯度（大标题/标题/正文/辅助/标签）、间距梯度（4/8/12/16/24/32）、圆角、阴影
3. 页面稿清单（V1.1 全量 11 页）：
   首页 / 分类页 / 列表页(搜索) / 商品详情 / 内容 Feed / 图文详情 / 视频详情 / 选品单列表 / 选品单详情 / 分享海报 / 个人中心

## 画板规格
- 基准 375 x 812（iPhone），出图 2x
- 组件命名 kebab-case；页面 Frame 命名与小程序路由一致（pages/index、pages/category、pages/goods/list、pages/goods/detail、pages/content/feed、pages/content/article、pages/content/video、pages/wishlist/list、pages/wishlist/detail、pages/user）
- 标注单位用 px；CC 换算 rpx：750rpx = 375px，即 1px = 2rpx
- 状态完整：默认/加载/空态/错误 四态都出（空态含插画或文案占位）

## CC 消费方式
1. 实现页面任务前，读 tasks.json 中该任务挂载的 Figma 链接与 token
2. 色值/字号/间距逐条对 token，不自造数值；token 缺失项用 Vant 默认并在 commit 中注明
3. 图标/切图从 Figma 导出 2x PNG/SVG 放 miniprogram/assets/icons/

## Hermes 验收方式
- automator 截图 vs Figma 页面稿，vision 像素级对照（布局、色值、留白、字体层级）
- 不要求 1:1 还原微交互动效，核心布局与视觉层级必须一致

## 关卡（硬性流程，不得跳过）
1. **Designer 出稿 → 用户确认 → 才派 CC 开发**：任何小程序 UI 还原类任务（MP-02~07）在派 CC 前，必须由用户本人看过 Figma 稿并明确同意；用户未确认前任务保持 blocked，不得开跑。
2. 用户确认方式：Hermes 把 Figma 链接（或导出截图）交给用户 → 用户回复确认 → Hermes 才把该任务状态从 blocked 改 pending 并派 CC。
3. 骨架/工程链路类任务（MP-01，不含视觉还原）是否随设计确认联动，以用户明确指示为准。
4. 设计稿确认后再改动需求：新需求记为新任务（不原位改旧任务），旧提交保留作回滚点。

## 缺口处理
- 设计稿未覆盖的边界（超长商品名、无图商品、多规格 SKU 展示）：CC 按 Vant 默认处理 + commit 注明 + 回写本文档「已决策」清单，Hermes 验收确认