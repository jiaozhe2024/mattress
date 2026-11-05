# 在线选品（床垫）小程序 PRD V1.1

- 版本：1.1（2026-11-04）
- 变更：新增「内容社区模块」（文章 & 视频 + 内容带货）；移除 V1.0 的搜索热词管理（降级为 backlog 可选增强）；补充技术约束与验收约定
- 状态：已确认技术选型，UI 由 Designer 在 Figma 产出，CC 开发，Hermes 验收

## 1. 业务逻辑

展示床垫商品，突出核心参数（材质、软硬度、厚度、适用人群），通过内容社区（文章/视频）种草带货，通过「选品单」沉淀用户种草结果并微信分享裂变。

## 2. 前端（小程序，微信原生 + Vant Weapp）

### 2.1 首页
- Banner 轮播、金刚区（分类导航）、推荐商品 Feed 流（瀑布流/双列列表，二选一，以 Figma 稿为准）

### 2.2 商品分类页 / 列表页
- 按分类浏览；列表页含搜索框（搜"席梦思"、"护脊"、"1.8米"这类关键词/材质/规格词）

### 2.3 商品详情页
- 主图/视频展示、核心参数卡片（材质/软硬度/厚度/适用人群）、详细图文介绍、底部操作栏（加入选品单）

### 2.4 内容社区（新增）
- 内容 Feed 流：图文/视频混合列表，支持按「最新」「最热」排序
- 图文详情页：富文本渲染、图片懒加载、底部关联商品推荐（内容带货）
- 视频详情页：视频播放器、全屏切换、底部关联商品

### 2.5 选品单（核心：收藏夹 & 分享）
- 选品单列表：展示用户所有选品单，支持新建、重命名、删除（如"主卧床垫备选"、"次卧床垫备选"）
- 选品单详情：单内商品列表（含总价/数量等聚合信息，以 Figma 稿为准）
- 分享：生成带小程序码的精美海报，或直接转发小程序卡片；好友点击直接打开该选品单

### 2.6 用户与系统
- 微信一键授权登录；个人中心入口（我的选品单）

## 3. 后端（服务端，FastAPI + SQLModel，单一 FastAPI 服务两套路由）

### 3.1 商品管理
- SPU/SKU 增删改查、上下架管理（Admin）
- 分类与标签维护（乳胶/弹簧/棕垫 + 属性标签）
- 接口：分页查询、详情查询、首页推荐数据聚合

### 3.2 搜索
- 商品名称/描述/标签模糊匹配；初期 MySQL FULLTEXT/LIKE（数据量 <10 万不上 Elasticsearch，非功能约束）

### 3.3 选品单
- 选品单 CRUD；维护 用户-选品单-商品 多对多；分享参数 scene=清单ID，被分享者打开时解析回显

### 3.4 内容社区（新增）
- 内容管理：文章（富文本/Markdown）与视频（URL/文件上传）的发布、编辑、下架（Admin）
- 内容关联：维护 内容-商品 关联（挂载商品链接）
- 接口：Feed 列表（最新/最热）、图文详情、视频详情、关联商品

### 3.5 用户体系与后台
- 微信 OpenID 绑定、用户基础信息管理
- Admin 后台：运营人员管理商品、分类、标签、内容及其关联（不含热词，V1.1 起）

## 4. 技术约束（已确认，写死）

- 小程序端：Uni-app + Vue3 + TS + Pinia（参考小兔鲜儿 uniapp-shop-vue3-ts；多清单选品状态必须 Pinia）
- 后端：FastAPI + SQLModel + MySQL 8 + Redis；参考基座 JiayuXu0/FastAPI-Template（MIT，复用 RBAC/JWT/arq），ORM 层自建 SQLModel
- Admin 前端：Vue3 + Element Plus + Vite，CC 直接生成，不套模板
- 用户分表：后台用户表仅管理运营人员；小程序用户独立 wx_user 表（openid 唯一索引），两群体永不混表
- 业务表前缀 gin_，与基座框架表分离；业务代码不依赖基座表结构，便于跟随上游升级
- 分享解析：wxacode.getUnlimited scene=清单ID（scene 长度 ≤32 字符约束）；新会话 onLoad 解析
- 微信真实 API（wx.login/code2session、订阅消息等）在开发/自动化环境必须 dev-mock；解析逻辑用单测覆盖
- 部署：腾讯云轻量 + Docker Compose（api/mysql/redis/admin nginx）+ 域名 ICP 备案 + HTTPS（小程序 request 合法域名硬性要求）
- 小程序无在线支付/订单（V1.1 范围外）；若未来增加交易，类目与资质另行评估

## 5. UI 设计与开发工作流（Figma）

- Designer 在 Figma 产出设计稿（375x812 基准，见 docs/design/figma-handoff.md）
- CC 必须依据 Figma 稿 + 设计 token 实现页面；Hermes 验收时对照 Figma 截图
- 小程序 UI 类任务状态 blocked_by: Figma 设计稿（见 tasks.json）

## 6. 验收约定

- 每页面/功能交付 scripts/e2e/<功能>.auto.js（miniprogram-automator）
- Hermes 三层验收：L1 diff 审查 → L2 vitest 单测 + automator E2E + 截图视觉对照 → L3 真机预览二维码（发布前用户确认）
- Admin/后端：pytest + curl 断言，验收见各任务 verify 字段

## 7. 数据模型（草案，BE-02 落地时细化）

gin_spu / gin_sku / gin_category / gin_tag / gin_spu_tag 关联 / gin_article / gin_video / gin_content_goods（内容-商品）/ wx_user / gin_wishlist（选品单）/ gin_wishlist_item（选品单-商品）

- 字段草案以 litemall goods 表（MIT）为参考，BE-02 输出完整 DDL

## 8. Backlog（暂不排期）

- 搜索热词管理（后台配置 + 展示）
- 海报生成为服务端合成（Pillow）或小程序 Canvas 出图（V1.1 先出"转发卡片"）
- Elasticsearch 搜索（数据量 >10 万时评估）
- 基础数据报表（分享/打开漏斗）