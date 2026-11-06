# BE-08 Sprint Output — Admin 内容管理 CRUD（轮播/分类/产品/资讯/品牌）

状态：submitted（待 Hermes 验收）
日期：2026-11-06
执行：CC（**接续 session**——前序多个 session 分段完成，本文档由收尾 session 汇总）

## 接续说明（各 session 交付明细）

### 前序 session 已交付（本文档 session 未改动）
| commit | 内容 |
|--------|------|
| b66f7cc | 后端：OSS 适配层（本地 mock 存储）+ /uploads 静态挂载 |
| 41fcebb | 后端：5 模块 admin CRUD API（banners/categories/products/articles/brand + upload） |
| 549a118 | 后端：27 条 pytest 用例全绿 |
| 16ae3df | 前端基建：api/content.ts + types/content.ts + ImageUpload / MultiImageUpload / RichTextEditor(wangEditor) 组件 |
| f634ed7 | 前端：轮播图管理（列表/新建编辑弹窗/jump_type 动态跳转值/状态开关/软删除） |
| d0e43c7 | 前端：产品分类管理（预置分类删除保护：is_preset 隐藏删除入口只许禁用） |

### 本 session 交付
| commit | 内容 |
|--------|------|
| fff8342 | 产品管理：接续上一 session 未提交的 views/product/index.vue（分页列表筛选 分类/名称/型号/状态；完整编辑表单=基础信息+主图单传+详情轮播图≤10+实拍图≤20+wangEditor 富文本+上下架开关；批量上下架带确认弹窗）+ /content/product 路由菜单 |
| 72c98d3 | 资讯与服务管理：views/article/index.vue（分类 news/service 筛选+标题 LIKE+状态；编辑弹窗=标题/分类 radio/封面单传/wangEditor 正文/发布开关；状态开关；软删除带确认）+ /content/article 路由菜单 |
| 831ea13 | 品牌信息配置：views/brand/index.vue（单页表单=介绍 textarea 5000 字/加盟电话前端校验 `^\d{6,20}$` 与后端一致/客服承诺可增删行编辑 ≤20 条且提交时过滤空白项/门店图多传 ≤20；首次无数据提示；GET null 安全）+ /content/brand 路由菜单 |

路由与菜单：五个模块全部挂 `/content` 目录下，`meta.rbacPath` 分别为 `/content/banner|category|product|article|brand`，与后端 `init_content_menus` 种子（init_app.py L213-311）逐一对齐，走 BE-03 的菜单级 RBAC 过滤（SideMenu + utils/menu.ts），超管全见。

## 前端消费的确切 Admin API 路由

全部经 axios 封装 baseURL=`/api/v1`，信封 `{code,msg,data}` 统一拆包：

| 模块 | 方法 + 路径 |
|------|------------|
| 上传 | POST /api/v1/admin/upload/image（multipart 字段 file） |
| 轮播 | GET/POST /api/v1/admin/banners；PUT /api/v1/admin/banners/{id}；PUT /api/v1/admin/banners/{id}/status；DELETE /api/v1/admin/banners/{id} |
| 分类 | GET/POST /api/v1/admin/categories；PUT /api/v1/admin/categories/{id}；PUT /api/v1/admin/categories/{id}/status；DELETE /api/v1/admin/categories/{id} |
| 产品 | GET /api/v1/admin/products?page&size&category_id&name&model&status；GET /api/v1/admin/products/{id}；POST /api/v1/admin/products；PUT /api/v1/admin/products/{id}；POST /api/v1/admin/products/batch-status |
| 文章 | GET /api/v1/admin/articles?page&size&category&title&status；GET /api/v1/admin/articles/{id}；POST /api/v1/admin/articles；PUT /api/v1/admin/articles/{id}；PUT /api/v1/admin/articles/{id}/status；DELETE /api/v1/admin/articles/{id} |
| 品牌 | GET /api/v1/admin/brand（缺失 data=null）；PUT /api/v1/admin/brand（upsert） |

## Verify 记录（真实输出）

### 1. npm run build（backend/admin）— 0 errors
```
> vue-tsc --noEmit && vite build
✓ built in 16.84s
```
（仅有 chunk >500kB 的体积 warning，非 error，见遗留风险）

### 2. 五模块 API curl 实测（backend 运行于 http://localhost:8000）
登录：`POST /api/v1/base/access_token {"username":"admin","password":"abcd1234"}` → token 获取成功（长度 151）。

| 端点 | 结果（截断） |
|------|------|
| GET /api/v1/admin/banners | code=200，2 条 seed banner（jump_type=2/3） |
| GET /api/v1/admin/categories | code=200，7 大预置分类，含 is_preset/product_count |
| GET /api/v1/admin/products?page=1&size=5 | code=200，分页 items 含 category_name/detail_images/real_images |
| GET /api/v1/admin/articles?page=1&size=5 | code=200，news+service 两类 seed 文章，列表 content=null（富文本仅详情返回，前端编辑走 GET /{id}） |
| GET /api/v1/admin/brand | code=200，单行 seed 品牌信息（intro/join_phone/service_promise/store_images） |

响应 shape 与 src/types/content.ts 类型定义逐字段核对一致。

### 3. 后端 pytest
后端 27 条 admin CRUD 用例前序 session 已全绿（549a118），本 session 未动任何后端 Python 代码，无需复跑（Hermes 验收时可复跑确认）。

## 操作说明（供验收走查）
- `cd backend/admin && npm run dev` → 登录 admin/abcd1234 → 侧边栏「内容管理」下五个菜单。
- 产品批量上下架：表格勾选 → 「批量上架/下架」→ 确认弹窗 → toast 显示 updated 数。
- 产品编辑：列表「编辑」走 GET /admin/products/{id} 拉全量富文本再回填。
- 品牌配置：加盟电话输入非纯数字（<6 位或含符号）blur 时前端拦截；后端 422 兜底。

## 遗留风险 / 备注
1. **seed 品牌电话与校验规则冲突**：seed 数据 join_phone=`400-800-1234`（含连字符），而后端 `_PHONE_PATTERN=^\d{6,20}$` 只许纯数字——seed 值直插库绕过了校验。管理员打开品牌页直接点保存会被前端校验拦截，需先把电话改成纯数字（如 4008001234）。属 seed 数据问题，建议记 tech-debt 或由 Hermes 定夺修 seed。
2. **构建体积 warning**：wangEditor + Element Plus 使主 chunk >500kB（gzip 后 414kB），非阻塞；后续可做 manualChunks 分包（不影响本任务验收）。
3. **浏览器交互走查未做**：本 session 仅验证 build 0 错误 + API shape 可达；弹窗交互/上传/富文本编辑器的浏览器实操走查留给 Hermes 验收（npm run dev）。
4. 产品「删除」语义 = 下架（status=0），无物理删除按钮，与后端设计一致（tasks.json verify 中「删除」按此语义走查）。
5. tasks.json BE-08 → submitted（按惯例**未 commit**，Hermes 所有权）。
