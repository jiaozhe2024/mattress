# 代码约定（CONVENTIONS）

> 基座参考 JiayuXu0/FastAPI-Template（MIT），沿用其 api → services → repositories 分层约定；ORM 按定稿用 SQLModel（模板官方为 Tortoise，已替换）。以下仅约定本项目新增部分。示例代码随首个模块落地后回填。

## 表命名
- 业务表一律 `gin_` 前缀：gin_spu / gin_sku / gin_category / gin_tag / gin_article / gin_video / gin_content_goods / wx_user / gin_wishlist / gin_wishlist_item
- 关联表命名：`gin_<a>_<b>`（如内容-商品 = gin_content_goods）
- 自增主键 `id`；统一字段 `created_at / updated_at / deleted`（逻辑删除，SQLModel 生态惯例）

## 路由
- 小程序端：`/wxapi/<feature>/<action>`（如 /wxapi/goods/list、/wxapi/auth/login、/wxapi/wishlist/share/123）
- Admin 端：`/api/v1/<resource>`（RESTful，资源名复数）；Admin 前端只调此前缀

## 文件与命名
- 小程序（Uni-app + Vue3 + TS）：`src/pages/<feature>/<page>.vue`（目录 kebab-case）；公共组件 `src/components/<Name>.vue`（PascalCase）；Pinia store `src/stores/use<X>Store.ts`
- e2e 脚本：scripts/e2e/<feature>.auto.js（与页面同名，同 commit）
- Python 模块：backend/src/{api,services,repositories}/<feature>/，router.py / service.py / repository.py（对应模板三层）；模型 backend/src/models/
- Admin 前端：backend/admin/src/views/<feature>/index.vue + backend/admin/src/api/<feature>.ts

## Commit 格式
`type(scope): 描述`，type ∈ feat/fix/refactor/test/docs/chore；如 `feat(wxapi): 选品单 CRUD 与 scene 分享解析`

## 待回填
- 小程序 src/utils 工具函数命名与导出约定（首个模块落地后补充）
- 设计 token（色板/字号/间距）以 docs/design/ 与 Figma 稿为准，落地后在此回填取值
