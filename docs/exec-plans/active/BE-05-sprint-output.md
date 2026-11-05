# BE-05 Sprint Output — wxapi 产品/首页聚合/资讯/品牌接口

> 状态：submitted（待 Hermes 验收）。日期：2026-11-05。
> 范围：仅 /wxapi 内容只读接口 7 个；不含 BE-06 方案 / BE-07 海报 / BE-08/09 Admin。

## 1. 变更清单（全部为新增，除 wxapi/__init__.py 加 2 行挂载）

| 文件 | 说明 |
|------|------|
| backend/src/repositories/wx_content.py | 内容域只读仓储：分页/过滤/排序/关键词 LIKE 封装（SQLAlchemy `contains(autoescape=True)` 参数绑定，**无裸拼 SQL**，核心约定 #3） |
| backend/src/schemas/wx_content.py | 响应 Schema（WxHomeOut/WxProductPageOut/WxArticlePageOut/产品列表项与详情/文章 summary 与详情/品牌/分类/banner；分页用具体 Schema 而非泛型，规避 pydantic Generic 兼容风险） |
| backend/src/services/wx_content_service.py | Service 层：模型 → Schema 组装，过滤/分页规则全部下沉 Repository |
| backend/src/api/v1/wxapi/content.py | 7 个匿名 GET 路由（不挂 wxapi JWT，不改 BE-04 auth 代码） |
| backend/src/api/v1/wxapi/__init__.py | 仅追加 content_router 挂载（BE-04 的 auth/users 挂载原样未动） |
| backend/tests/test_wxapi_content.py | 24 个用例（sqlite + demo_seed，覆盖 verify 全部要求） |

端点清单（前缀 /api/v1/wxapi，信封 {code,msg,data}）：
1. `GET /home` — banners(status=1,sort asc) + categories(status=1,sort asc) + services(gin_article category='service' 且 status=1，id asc) 一次返回
2. `GET /categories` — status=1，sort asc
3. `GET /products` — page/size(≤50)、category_id、keyword（name/model/slogan/spec 四字段 LIKE OR）、sort=comprehensive|newest；仅 status=1
4. `GET /products/{id}` — 完整详情含 detail_images/real_images JSON + detail_content 富文本 + category_name；下架/不存在 → 404
5. `GET /articles` — page/size(≤50)、可选 category=news|service 过滤；仅 status=1；created_at desc
6. `GET /articles/{id}` — 含 content 富文本；下线/不存在 → 404
7. `GET /brand` — gin_brand_info 单行（约定取 id 最小行）

## 2. 契约决策（小程序端对接需知）

- **文章 category 值**：`news`（宝顿资讯）/ `service`（服务板块），来源 models/enums.py `ArticleCategory`（StrEnum），未猜测、与 BE-02 seed 一致。/home 的 services 段 = category='service' 且已发布。
- **分页载荷**：data = `{items, total, page, size}`（信封内），非顶层 total 字段。
- **时间字段**：对外统一 `create_time`（映射模型 `created_at`），ISO-8601 字符串（如 `2026-11-05T21:16:33`）。
- **排序参数**：`sort=comprehensive`（默认，sort asc + id asc）| `sort=newest`（created_at desc）；非法值 422。
- **size 上限 50**：size>50 → 422（FastAPI Query le=50）。
- **文章列表不返回富文本 content**（summary 字段：id/title/category/cover/create_time），详情才返回。
- **/brand 无数据时**：200 + `data=null`（不 404，小程序端做空态兜底）。
- **keyword 中的 % 和 _**：autoescape 转义为字面量，不作为通配符。

## 3. Verify 复跑指令与真实输出

### 3.1 pytest（backend/ 内，sqlite + demo_seed）

```
uv run --python 3.13 python3 -m pytest tests/test_wxapi_content.py -v
→ 24 passed, 32 warnings in 3.70s（exit 0）

uv run --python 3.13 python3 -m pytest tests/ -q
→ 全量绿（exit 0，1 skipped = 基座 sensitive word filter 依赖缺失，与本任务无关；BE-04 时为 50 passed，现新增 24 例）
```

覆盖：分页计数与 seed 一致（7 产品/7 分类/2 banner/2 文章/1 品牌）；下架产品列表不可见且详情 404；『卷绵』命中「卷绵时代·舒卷床垫」(JM-SJ-001)；model/spec 关键词命中；size=51 → 422；/home 三段齐全；/brand seed 信息完整；文章下线列表消失+详情 404。

### 3.2 curl（容器 http://localhost:8000，前缀 /api/v1；web 镜像已重建 `docker compose build web && docker compose up -d web`，dev MySQL seed 数据）

```
GET /wxapi/home            → code 200 | banners:2 categories:7 services:1
                             services[0] = 免费床垫除螨保养服务 (category=service)
GET /wxapi/categories      → 7 条：9M特制床垫/花筑手作/卷绵时代/小斑马/特制软床/抗菌软床/助眠枕头（sort asc）
GET /wxapi/products?page=1&size=3 → total:7 items:3 page:1 size:3
GET /wxapi/products?keyword=卷绵   → total:1 命中「卷绵时代·舒卷床垫」
GET /wxapi/products?size=51        → 422
GET /wxapi/products/1              → name:9M 尊享特制床垫 category_name:9M特制床垫
                                     detail_images:2 real_images:2 detail_content:<h3>…富文本
GET /wxapi/articles?page=1&size=10 → total:2（news+service 各 1，含 id/title/category/cover/create_time，无 content）
GET /wxapi/articles/2              → content 富文本返回
GET /wxapi/articles?category=service → total:1
GET /wxapi/articles/999999         → 404
GET /wxapi/brand                   → intro(宝顿寝具…)/join_phone:400-800-1234/service_promise:4 条/store_images:2 张
```

**下架 404 实测**（dev 库临时改状态后已恢复）：
```
UPDATE gin_product SET status=0 WHERE model='JM-SJ-001';
GET /wxapi/products?keyword=卷绵 → total:0（列表不可见）
GET /wxapi/products?size=50      → total:6，JM-SJ-001 不在 items
GET /wxapi/products/3            → 404
UPDATE 恢复 status=1 后 GET /wxapi/products/3 → 200
```

## 4. 自我批判 / 遗留风险

- **潜在性能**：/home 每请求 3 次独立查询、无缓存；seed 量级无感，产品上量后可加 Redis 短 TTL 缓存（未做，避免过度设计）。
- **LIKE 搜索**：`%kw%` 前置通配不走索引；数据量 <10 万符合约定（禁 ES），量级逼近时再评估 FULLTEXT（Repository 已收口，改一处即可）。
- **匿名接口无限流**：沿用 wxapi 路由组现状（BE-04 登录接口同样未单独限流），如需限流建议统一在中间件层加（回写 backlog 由 Hermes 决策）。
- **部署注意**：web 容器无源码 volume 挂载，上线新代码必须 `docker compose build web && up -d web`（本次已重建）。
- **detail_images/real_images 类型为 list[Any]**：JSON 列内容默认是 URL 字符串数组，Schema 未强约束元素类型（Admin 上传 BE-08 落地后如需可收紧）。

## 5. 边界确认

- 未改 BE-04 任何 auth/WxUser 代码（wxapi/__init__.py 仅追加挂载行）。
- 未动 aaa.md/AGENTS.md/tasks.json 以外文件；tasks.json 仅改 BE-05 status → submitted（不 commit，Hermes 所有）。
- 无同步库进 async 路由（无外部调用，纯 DB 只读）；未建任何新表/迁移（复用 BE-02 模型）。

---

## Evaluator 复跑评审（Hermes，2026-11-05）

背景：BE-05 的 CC 完成通知未送达（平台侧通知丢失），Hermes 未及时触发验收，经用户询问后盘点到已完成提交，随即独立复跑——属通知链路问题，非任务交付问题。

独立复跑（容器 backend 四件套 healthy，localhost:8000）：

| # | verify 项 | 命令 | 结果 |
|---|---|---|---|
| 1 | pytest 全量 | `.venv/bin/python -m pytest tests/ --tb=no -q` | exit 0；test_wxapi_content.py 24/24 通过（`........................` [100%]） |
| 2 | 下架产品不出列表+详情 404 | test_off_shelf_product_absent_from_list / test_detail_off_shelf_404（sprint_output §3 实测 + pytest 实跑） | 通过；另 curl 不存在的 99999 → 404 |
| 3 | 关键词搜索「卷绵」 | `curl "/wxapi/products?keyword=卷绵"` | hit=1，命中「卷绵时代·舒卷床垫」 |
| 4 | 分页与 seed 一致 | `curl "/wxapi/products?page=1&size=10"` | total=7 返回 7 条（与 BE-02 seed 产品数一致） |
| 5 | /home 三段齐全 | `curl /wxapi/home` | banners=2, categories=7, services=1（三段非空） |
| 6 | /brand 返回 seed | `curl /wxapi/brand` | id/intro/join_phone/service_promise/store_images 字段齐 |

补充：size>50 拒绝、分类禁用隐藏、article 下架 404、排序（newest/comprehensive）等 24 用例全部覆盖，CC 实测输出与 Hermes 复跑一致。

结论：**approved**。BE-05 置 done。解锁 BE-06（方案 CRUD+快照+分享，blocked_by BE-04/BE-05 已满足）。
