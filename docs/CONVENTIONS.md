# 代码约定（CONVENTIONS）

> 基座参考 JiayuXu0/FastAPI-Template（MIT），沿用其 api → services → repositories 分层约定；ORM 按定稿用 SQLModel（模板官方为 Tortoise，已替换）。以下仅约定本项目新增部分。示例代码随首个模块落地后回填。

## 表命名
- 业务表一律 `gin_` 前缀：gin_product_category / gin_product / gin_scheme / gin_scheme_product / gin_banner / gin_article / gin_brand_info；小程序用户表 `wx_user`（openid 唯一索引，不进后台用户体系）
- 关联表命名：`gin_<a>_<b>`（如方案-产品 = gin_scheme_product）
- 自增主键 `id`；统一字段 `created_at / updated_at`（软删除用 `deleted`，SQLModel 生态惯例）
- Admin 管理员/角色/权限/操作日志走基座 RBAC 表，不占 gin_ 前缀

## 路由
- 小程序端：`/wxapi/<feature>/<action>`（如 /wxapi/product/list、/wxapi/auth/login、/wxapi/schemes/share/123）
- Admin 端：`/api/v1/<resource>`（RESTful，资源名复数）；Admin 前端只调此前缀

## 文件与命名
- 小程序（Uni-app + Vue3 + TS）：`src/pages/<feature>/<page>.vue`（目录 kebab-case）；公共组件 `src/components/<Name>.vue`（PascalCase）；Pinia store `src/stores/use<X>Store.ts`
- e2e 脚本：scripts/e2e/<feature>.auto.js（与页面同名，同 commit）
- Python 模块：backend/src/{api,services,repositories}/<feature>/，router.py / service.py / repository.py（对应模板三层）；模型 backend/src/models/
- Admin 前端：backend/admin/src/views/<feature>/index.vue + backend/admin/src/api/<feature>.ts

## 关键业务规则（V2.0）
- 方案创建/更新必须固化产品快照 JSON（product_snapshot），历史方案不随产品更新变化（aaa.md §4.3.1）
- 越权防护：修改/删除方案校验 gin_scheme.user_id == 当前 wx_user.id，否则 403
- 分享计数：分享成功后 POST /wxapi/schemes/{id}/share 才 +1
- 公开预览接口（/schemes/{id}/public）免登录，但不返回创建者敏感信息

## Commit 格式
`type(scope): 描述`，type ∈ feat/fix/refactor/test/docs/chore；如 `feat(wxapi): 方案 CRUD 与快照生成`

## 小程序前端约定（MP-02 落地回填）
- API 层：`src/api/<domain>.ts`（如 api/content.ts），统一走 utils/request.ts 的 get/post/put/del；页面自管 loading/empty/error 三态时传 `{ silent: true }` 避免重复 toast
- 资源 URL：后端图片字段为相对路径（/uploads/...），一律经 `utils/url.ts absoluteUrl()` 补全（VITE_ASSET_BASE_URL）；OSS 适配层落地前 dev 环境图片 404，UI 必须有占位回退层
- 跳转：tabBar 页一律 switchTab（不带参），跨页传参走 Pinia（如 useProductFilterStore.requestedCategoryId），禁止 storage/全局变量（核心约定 9）
- banner 跳转分发：`utils/jump.ts resolveBannerTarget()` 纯函数（jump_type 1 无 2 分类 3 产品 4 外链，非法值 → invalid），单测覆盖

## 设计 token（来源 docs/design/figma-exports/ds-page.png，LEKASI 品牌）
- 色板：navy 主色 #1A2260 / navyDeep #111639 / yellow 强调 #F7C400 / yellowHover #E0B000 / yellowBg #FFF8E1 / cream 背景 #FDFBF5 / navySoft #E7EAF6 / navy50 #8890B8
- 灰阶：text1 #1E2330 / text2 #4A5165 / text3 #8A90A3 / line #E9ECF2 / fill #F4F6FA / textInv #FFFFFF
- 功能：success #3FA96C / warning #EE9B2E / danger #E5573D / feelBg 睡感 #FFF3C4 / feelTx #6B4E00
- 字号（px，行高 1.45；rpx=px×2）：H1 24 / H2 20 / H3 16 / BODY 14 / CAPTION 13 / LABEL 11；标题 SemiBold、正文 Regular
- 间距：4/8/12/16/24/32 px；卡片圆角 12px、内部块 8px、胶囊 999px
- 悬浮选款按钮：Figma ds 取 yellow #F7C400 + navy 角标（取代 aaa.md §3.1.2 早期品牌金 #D4A574，品牌视觉以 LEKASI 设计稿为准；尺寸仍按 aaa.md 56rpx 圆形）

## 待回填
- 小程序 src/utils 后续工具模块沿用 camelCase 纯函数 + vitest 单测（jump/url 已落地）