# DB_SCHEMA — 业务数据模型（V2.0，BE-02）

> 权威依据：`aaa.md` §5（技术需求规格说明书 V2.0）+ `docs/product-specs/PRD-v2.0.md` §7。
> 落地形态：SQLModel 模型 `backend/src/models/`（product.py / wx_user.py / scheme.py / content.py），
> 迁移链 `backend/migrations/`（alembic，首个迁移 `61798386a738`），本文档描述的是**已应用到 MySQL8 的真实结构**。
>
> 核心约定（AGENTS.md）：
> - 业务表一律 `gin_` 前缀；小程序用户表 `wx_user` 与基座后台用户表 `user` **严格分表，永不混写**（约定 #1）
> - 商品**无独立 SKU 表**，规格内嵌字段（V2.0 定稿）
> - 方案快照：`gin_scheme_product.product_snapshot` JSON 固化，历史方案不随产品更新变化（约定 #10，aaa.md §4.3.1）
> - 基座表（user/role/menu/api/dept/deptclosure/auditlog/file_mapping/userrole/rolemenu/roleapi）由 FastAPI-Template 基座管理（`core.db.init_db()` create_all），**不在 alembic 迁移链内**，结构保持原样

## 通用约定

| 项 | 约定 |
|----|------|
| 存储引擎/字符集 | InnoDB / utf8mb4（utf8mb4_unicode_ci） |
| 主键 | `id BIGINT AUTO_INCREMENT`（业务表统一 `BusinessBaseModel`；sqlite 测试方言回落 INTEGER 以支持自增） |
| 时间字段 | `created_at` / `updated_at` `DATETIME NOT NULL`，由应用层写入（`TimestampMixin`，本地 naive 时间，updated_at 带 onupdate） |
| 状态字段 | `status INT NOT NULL DEFAULT`（应用层默认 1）：0 禁用/下架，1 启用/上架（`CommonStatus`）。aaa.md DDL 为 TINYINT，落地统一 INT，值域由应用层枚举约束 |
| JSON 字段 | MySQL `json` 列（sqlite 测试回落 TEXT 序列化） |
| 富文本 | `LONGTEXT`（SQLAlchemy `Text().with_variant(mysql.LONGTEXT)`） |
| 命名 | 索引 `ix_<表>_<列>`；外键由 MySQL 自动命名 `<表>_ibfk_N` |

## 关系总览

```
gin_product_category 1 ──── n gin_product
wx_user              1 ──── n gin_scheme
gin_scheme           1 ──── n gin_scheme_product   （ON DELETE CASCADE + ORM delete-orphan）
gin_product          1 ──── n gin_scheme_product   （仅溯源，不级联；快照已固化展示数据）
gin_banner / gin_article / gin_brand_info           独立内容表（无外键）
```

---

## 1. `gin_product_category` — 产品分类表

模型：`models/product.py::GinProductCategory`。V3 定稿 8 个分类（seed，用户 2026-11-14 决策），**只许禁用不许删**（BE-08）。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| name | VARCHAR(50) | NOT NULL | 分类名称（入口标题文字） |
| subtitle | VARCHAR(100) | NULL | 分类副文案文字（入口说明行，如「六大专属　分龄深睡」）**BE-10 新增** |
| icon | VARCHAR(255) | NULL | 分类图标 URL |
| banner_image | VARCHAR(255) | NULL | 分类入口图片 URL（标题+文案做成图片时的整块图片）**BE-10 新增** |
| parent_id | BIGINT | NULL | 父分类 ID（**预留**，V2.0 不启用层级） |
| sort | INT | NOT NULL, 应用默认 0 | 排序值，越小越靠前 |
| status | INT | NOT NULL, 应用默认 1 | 0 禁用 / 1 启用 |
| created_at / updated_at | DATETIME | NOT NULL | 见通用约定 |

渲染规则（前端）：分类入口**有 `banner_image` 时优先渲染图片**，无图时降级渲染 `name` + `subtitle` 文字。两者都由接口返回，前端不做取舍判断以外的逻辑。

索引：`ix_gin_product_category_sort (sort)`、`ix_gin_product_category_status (status)`、`ix_gin_product_category_id`、`ix_gin_product_category_created_at`、`ix_gin_product_category_updated_at`

## 2. `gin_product` — 产品表（无独立 SKU 表）

模型：`models/product.py::GinProduct`。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| category_id | BIGINT | NOT NULL, FK → `gin_product_category.id` | 所属分类 |
| name | VARCHAR(100) | NOT NULL | 产品名称 |
| model | VARCHAR(50) | NOT NULL, **UNIQUE** | 产品型号（唯一键 `ix_gin_product_model`） |
| slogan | VARCHAR(100) | NULL | 产品标语 |
| spec | VARCHAR(50) | NULL | 规格尺寸（内嵌，无 SKU 表） |
| sleep_feel | VARCHAR(20) | NULL | 睡感标签（详情页 #FFE4E1 标签） |
| main_image | VARCHAR(255) | NOT NULL | 主图 URL |
| detail_images | JSON | NULL | 详情轮播图 URL 数组（≤10，BE-08 约束） |
| real_images | JSON | NULL | 实拍图 URL 数组（≤20，BE-08 约束） |
| detail_content | LONGTEXT | NULL | 产品详情富文本（小程序 rich-text 渲染） |
| sort | INT | NOT NULL, 应用默认 0 | 排序值 |
| status | INT | NOT NULL, 应用默认 1 | 0 下架 / 1 上架（下架不出现在 wxapi 列表且详情 404，BE-05） |
| created_at / updated_at | DATETIME | NOT NULL | 见通用约定 |

索引：`UNIQUE ix_gin_product_model (model)`、`ix_gin_product_category_id`、`ix_gin_product_status`、`ix_gin_product_sort`、`ix_gin_product_id`、`ix_gin_product_created_at`、`ix_gin_product_updated_at`
外键：`gin_product_ibfk_1 (category_id) → gin_product_category(id)`
搜索：name/model 走 MySQL LIKE/FULLTEXT（Repository 层封装，**禁止 Elasticsearch**，约定 #3）

## 3. `wx_user` — 小程序用户表（与基座 user 表严格分表）

模型：`models/wx_user.py::WxUser`。由 BE-04 wx.login 登录链路自动创建，不支持后台手动建用户。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| openid | VARCHAR(64) | NOT NULL, **UNIQUE** | 微信 openid（唯一索引 `ix_wx_user_openid`） |
| nickname | VARCHAR(100) | NULL | 微信昵称 |
| avatar | VARCHAR(255) | NULL | 头像 URL |
| status | INT | NOT NULL, 应用默认 1 | 0 禁用（登录被拒，BE-09）/ 1 启用 |
| last_login_at | DATETIME | NULL | 最后登录时间 |
| created_at / updated_at | DATETIME | NOT NULL | 见通用约定 |

索引：`UNIQUE ix_wx_user_openid (openid)`、`ix_wx_user_status`、`ix_wx_user_last_login_at`、`ix_wx_user_id`、`ix_wx_user_created_at`、`ix_wx_user_updated_at`

## 4. `gin_scheme` — 方案表（V2.0 核心）

模型：`models/scheme.py::GinScheme`。导购为客户定制的选品方案主记录。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| user_id | BIGINT | NOT NULL, FK → `wx_user.id` | 创建用户（仅 wx_user，不引用基座 user） |
| title | VARCHAR(100) | NOT NULL | 方案标题（BE-06 校验 1-100 字必填） |
| remark | TEXT | NULL | 详细说明（选填） |
| product_count | INT | NOT NULL, 应用默认 0 | 产品数量（冗余计数，随快照维护） |
| share_count | INT | NOT NULL, 应用默认 0 | 分享次数（POST /schemes/{id}/share +1） |
| created_at / updated_at | DATETIME | NOT NULL | 列表按 created_at desc 分页（BE-06） |

索引：`ix_gin_scheme_user_id`、`ix_gin_scheme_id`、`ix_gin_scheme_created_at`、`ix_gin_scheme_updated_at`
外键：`gin_scheme_ibfk_1 (user_id) → wx_user(id)`
说明：软删除标记（BE-06）留待该任务按需追加 alembic 迁移，本任务不预置 aaa.md §5 之外的字段。

## 5. `gin_scheme_product` — 方案产品快照表

模型：`models/scheme.py::GinSchemeProduct`。**约定 #10**：创建/更新方案时固化产品展示信息 JSON，产品后续更新不影响历史方案。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| scheme_id | BIGINT | NOT NULL, FK → `gin_scheme.id` **ON DELETE CASCADE** | 方案删除时快照行级联删除（ORM 侧同时配 `cascade="all, delete-orphan"`） |
| product_id | BIGINT | NOT NULL, FK → `gin_product.id` | 原产品 ID（仅溯源，快照固化后展示不依赖它） |
| product_snapshot | JSON | **NOT NULL** | 产品快照：id/name/model/main_image/spec/sleep_feel/detail_content 等展示字段（aaa.md §4.3.1） |
| sort | INT | NOT NULL, 应用默认 0 | 方案内排序 |
| created_at / updated_at | DATETIME | NOT NULL | 见通用约定 |

索引：`ix_gin_scheme_product_scheme_id`、`ix_gin_scheme_product_product_id`、`ix_gin_scheme_product_sort`、`ix_gin_scheme_product_id`、`ix_gin_scheme_product_created_at`、`ix_gin_scheme_product_updated_at`
外键：`gin_scheme_product_ibfk_1 (product_id) → gin_product(id)`；`gin_scheme_product_ibfk_2 (scheme_id) → gin_scheme(id) ON DELETE CASCADE`

## 6. `gin_banner` — 轮播图表

模型：`models/content.py::GinBanner`。首页 banner，autoplay 5s（MP-02）。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| image | VARCHAR(255) | NOT NULL | 图片 URL |
| jump_type | INT | NOT NULL, 应用默认 1 | 跳转类型（`BannerJumpType`）：1 无 / 2 分类 / 3 产品 / 4 外链 |
| jump_value | VARCHAR(255) | NULL | 跳转目标值：分类 ID / 产品 ID / 外链 URL |
| sort | INT | NOT NULL, 应用默认 0 | 排序值 |
| status | INT | NOT NULL, 应用默认 1 | 0 禁用 / 1 启用 |
| created_at / updated_at | DATETIME | NOT NULL | 见通用约定 |

索引：`ix_gin_banner_sort`、`ix_gin_banner_status`、`ix_gin_banner_id`、`ix_gin_banner_created_at`、`ix_gin_banner_updated_at`

## 7. `gin_article` — 资讯与服务表

模型：`models/content.py::GinArticle`。`category=service` 的记录构成首页「品牌服务」横滚卡片与 `/wxapi/home` 的 services 段（BE-05）。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| title | VARCHAR(100) | NOT NULL | 标题 |
| category | VARCHAR(20) | NOT NULL, 默认 'news' | 分类（`ArticleCategory`）：`news` 宝顿资讯 / `service` 服务板块 |
| cover | VARCHAR(255) | NULL | 封面图 URL |
| content | LONGTEXT | NULL | 富文本内容 |
| status | INT | NOT NULL, 应用默认 1 | 0 下线 / 1 发布 |
| created_at / updated_at | DATETIME | NOT NULL | 列表按 created_at desc 分页 |

索引：`ix_gin_article_category`、`ix_gin_article_status`、`ix_gin_article_id`、`ix_gin_article_created_at`、`ix_gin_article_updated_at`

## 8. `gin_brand_info` — 品牌信息配置表（单行）

模型：`models/content.py::GinBrandInfo`。**单行配置**：应用层约定只保留一行（后台单页表单编辑，`/wxapi/brand` 取第一行）。

| 字段 | 类型 | 约束/默认 | 说明 |
|------|------|-----------|------|
| id | BIGINT | PK, AUTO_INCREMENT | 主键 |
| intro | TEXT | NULL | 品牌介绍（成立时间/总部/规模/门店数/定位文案） |
| join_phone | VARCHAR(20) | NULL | 招商加盟电话（MP-06 `wx.makePhoneCall` 拨号） |
| service_promise | JSON | NULL | 客服承诺字符串数组 |
| store_images | JSON | NULL | 门店图 URL 数组 |
| created_at / updated_at | DATETIME | NOT NULL | 见通用约定 |

索引：`ix_gin_brand_info_id`、`ix_gin_brand_info_created_at`、`ix_gin_brand_info_updated_at`

---

## 迁移与 Seed（开发环境操作手册）

```bash
cd backend

# 1. 迁移（只创建/变更 gin_/wx_ 业务表，基座表永不触碰）
#    宿主执行需覆盖 .env 的容器内主机名：
DB_HOST=127.0.0.1 DB_PORT=13306 .venv/bin/alembic upgrade head

# 2. 演示数据 seed（幂等：gin_product_category 已有数据即跳过）
DB_HOST=127.0.0.1 DB_PORT=13306 .venv/bin/python scripts/seed_demo_data.py

# 3. 核对
docker compose exec mysql mysql -u mattress -p mattress -e "SHOW TABLES;"   # gin_/wx_ 共 8 张
```

Seed 内容（`backend/src/utils/demo_seed.py`）：7 大分类（9M特制床垫/花筑手作/卷绵时代/小斑马/特制软床/抗菌软床/助眠枕头）、7 个产品（每分类 1 款，含 detail_images/real_images JSON + detail_content 富文本）、2 条 banner（jump_type=2 分类 / 3 产品）、2 篇文章（1 service + 1 news）、1 条品牌信息。不 seed wx_user（由 BE-04 登录链路创建）。图片为 `/uploads/demo/` 占位，OSS 适配层落地后由 Admin 上传替换。

## 与 aaa.md §5 DDL 的落地差异（有意为之）

| aaa.md DDL | 实际落地 | 原因 |
|-----------|---------|------|
| 表名无前缀（product/user/scheme...） | `gin_` 前缀 + `wx_user` | AGENTS.md 约定 #1/#2（tasks.json BE-02 为准），且基座已占用 `user` 表名 |
| TINYINT status/jump_type | INT | SQLModel/SQLAlchemy 通用整型；值域由应用层枚举（CommonStatus/BannerJumpType）约束 |
| DATETIME DEFAULT CURRENT_TIMESTAMP | 应用层 default_factory | 与基座 TimestampMixin 统一；sqlite 测试方言无 ON UPDATE 语义 |
| user 表仅 created_at | wx_user 含 created_at+updated_at | 复用 TimestampMixin，超集不冲突 |
| 5.2 未含 article/brand_info | 按 PRD §7 补齐 | V2.0 八表以 PRD §7 清单为准 |
