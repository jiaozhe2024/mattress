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

## 待回填
- 小程序 src/utils 工具函数命名与导出约定（首个模块落地后补充）
- 设计 token（色板/字号/间距）以 docs/design/ 与设计稿为准，落地后在此回填取值