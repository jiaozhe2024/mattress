# 代码约定（CONVENTIONS）

> 基座 RuoYi-FastAPI 自带其官方约定（application/ 分层、sys_* 表、其前端目录结构），沿用，不另起炉灶。以下仅约定本项目新增部分。示例代码随首个模块落地后回填。

## 表命名
- 业务表一律 `gin_` 前缀：gin_spu / gin_sku / gin_category / gin_tag / gin_article / gin_video / gin_content_goods / wx_user / gin_wishlist / gin_wishlist_item
- 关联表命名：`gin_<a>_<b>`（如内容-商品 = gin_content_goods）
- 自增主键 `id`；统一字段 `create_time / update_time / deleted`（逻辑删除，若依惯例）

## 路由
- 小程序端：`/wxapi/<feature>/<action>`（如 /wxapi/goods/list、/wxapi/auth/login、/wxapi/wishlist/share/123）
- Admin 业务路由沿用若依 /dev-api 体系与代码生成器输出格式

## 文件与命名
- 小程序 pages：pages/<feature>/<page>/index.{js,json,wxml,wxss}（微信原生约定）
- 小程序公共组件：components/<name>/（kebab-case）
- e2e 脚本：scripts/e2e/<feature>.auto.js（与页面同名，同 commit）
- Python 模块：application/apps/gin_<feature>/ 下 controller.py / service.py / dao.py（对应若依 FastAPI 版分层）

## Commit 格式
`type(scope): 描述`，type ∈ feat/fix/refactor/test/docs/chore；如 `feat(wxapi): 选品单 CRUD 与 scene 分享解析`

## 待回填
- 小程序 utils 工具函数命名与导出约定（首个模块落地后补充）
- 设计 token（色板/字号/间距）以 docs/design/ 与 Figma 稿为准，落地后在此回填取值