# BE-10 Sprint Output — 分类副文案字段 + V3 演示数据重写（LEKASI 八分类）

状态：submitted（待 Hermes 验收）
日期：2026-11-14
执行：CC

## 1. 交付概览

| 项 | 结果 |
|----|------|
| `gin_product_category` 新增 `subtitle VARCHAR(100) NULL` / `banner_image VARCHAR(255) NULL` | 完成，alembic revision `be10cat2f7a1` |
| Admin / wxapi 出参与入参贯通 | 完成（4 个 schema + 2 个 service helper） |
| Admin 分类页 subtitle 输入 + banner_image 上传 + 列表缩略图 | 完成，`npm run build` RC 0 |
| DEMO_CATEGORIES 重写为 V3 八分类（sort 1..8，banner_image 全 null） | 完成 |
| DEMO_PRODUCTS 重写为 8 款，一分类一款，规格/睡感统一 | 完成 |
| seed 幂等（分类表非空即跳过） | 保持不变 |
| pytest 全量 | 139 tests / 0 failed / 0 error / 1 skipped（既有基座 sensitive-word 跳过） |
| 干净库单独跑分类相关测试文件 | 4 个文件全绿（见 §4.2） |

## 2. 改动文件

### 后端
| 文件 | 改动 |
|------|------|
| `backend/src/models/product.py` | `GinProductCategory` 增 `subtitle` / `banner_image`；**同时修复 BE-06 记录的 sqlite 索引撞名技术债**：`GinProduct.category_id` 从 `sa_type=BigInteger + foreign_key + index=True` 改为 `sa_column=Column(BigInteger, ForeignKey(...), nullable=False)` + `__table_args__=(Index("ix_gin_product_category_fk", "category_id"),)`。MySQL 索引名表级隔离，生产/容器已建库无需迁移；SQLite 索引名库级唯一，干净库必须显式改名（BE-10 verify 明确要求 `rm backend/test.db` 后单独跑分类测试文件通过）。 |
| `backend/migrations/versions/20261114_be10cat2f7a1_category_subtitle_banner.py` | 新增迁移：`add_column(gin_product_category, subtitle String(100) nullable)` + `add_column(..., banner_image String(255) nullable)`，downgrade 反向 drop。 |
| `backend/src/schemas/admin_content.py` | `CategoryCreate/CategoryUpdate/CategoryOut` 增 `subtitle`（max 100）与 `banner_image`（max 255），均可空；`CategoryOut.is_preset` 描述 7 大 → 8 大。 |
| `backend/src/schemas/wx_content.py` | `WxCategoryOut` 增 `subtitle` / `banner_image`（均可空，附 Q15 双通道说明）。 |
| `backend/src/services/admin_content_service.py` | `_category_out` 透传两字段；注释与删除错误文案 7 大 → 8 大（`PRESET_CATEGORY_NAMES` 本就派生自 `DEMO_CATEGORIES`，无名单硬编码漂移）。 |
| `backend/src/services/wx_content_service.py` | `_category_out` 透传两字段（`/wxapi/categories` 与 `/wxapi/home` 共用该 helper，一处生效）。 |
| `backend/src/utils/demo_seed.py` | 整体重写演示数据（见 §3）。 |

### Admin 前端
| 文件 | 改动 |
|------|------|
| `backend/admin/src/types/content.ts` | `Category` 增 `subtitle` / `banner_image`（nullable）；`CategoryCreate` 增两个可选字段。 |
| `backend/admin/src/views/category/index.vue` | 表格新增「入口图」列（`el-image` 90×44 预览，空显示「未上传」）与「副文案」列；弹窗新增「副文案」输入（maxlength 100、前端 rules max 100）与「入口图」`ImageUpload`（复用 BE-08 组件=POST /admin/upload/image）；`CategoryFormState` / `emptyForm` / `openEdit` / `onSubmit` 映射（subtitle trim 后空串转 null）；alert 文案 7 大 → 8 大；新增 `.category-banner` 样式。 |

### 测试
| 文件 | 改动 |
|------|------|
| `backend/tests/test_business_models.py` | seed 计数断言 7/≥6 → 8/8，幂等二次 8。 |
| `backend/tests/test_wxapi_content.py` | 首页/分类断言 8 条 + subtitle/banner_image 字段；新增 `test_categories_carry_subtitle_and_banner_image`（8 条副文案精确值 + 两段式用全角空格校验，单段分类 5/6/7 不校验）；产品用例改 8 款/LEKASI 型号/一分类一款/关键词 505压缩；禁用分类用「双面控」→ 7 条；品牌电话断言 `4008001234`（见 §5.1）。 |
| `backend/tests/test_admin_content.py` | 预置分类 8 条 + 两字段断言；新增 `test_create_update_subtitle_and_banner_image`（含 subtitle 101 字符 → 422）；预置删除/改名/重名用例改用 V3 分类名；产品筛选/创建/批量上下架用新分类名与新型号。 |
| `backend/tests/test_wxapi_schemes.py` | 快照用例型号改用 seed 现存的 `LEKASI-505-180` / `LEKASI-3D-180`（原 `JM-SJ-001` / `9M-ZX-180` 已随 V3 seed 消失）。 |

## 3. Seed 数据（V3 定稿）

八分类（顺序=sort 1..8，`icon` 为本地 mock 路径，`banner_image` 全 `None`）：

| sort | name | subtitle | 全角空格(U+3000) |
|---|---|---|---|
| 1 | 6S专属床垫 | 六大专属　分龄深睡 | 是 |
| 2 | 手工 · 零胶虑 | 大师手作　奢睡体验 | 是 |
| 3 | 姜大师 · 草本 | 暖姜纤维　古法温养 | 是 |
| 4 | 双面控 | 冷暖可调　软硬可调 | 是 |
| 5 | 零压 · 深睡 | 睡眠无压力 | 否（定稿单段） |
| 6 | “卷”起来 | 爱上卷包床垫 | 否（定稿单段） |
| 7 | 次卧 · 不次等 | 卧室就要睡好觉 | 否（定稿单段） |
| 8 | 薄垫 · 不薄待 | 厚度降低　睡感加分 | 是 |

八产品（一分类一款，spec 全 `1800 × 2000 mm`，sleep_feel 全 `舒适睡感`，各带 2 张 detail_images / 2 张 real_images / 富文本 detail_content）：

| sort | 分类 | 产品 | 型号 |
|---|---|---|---|
| 1 | 6S专属床垫 | 3D床垫 | LEKASI-3D-180 |
| 2 | 手工 · 零胶虑 | 幸福3号 | LEKASI-XF3-180 |
| 3 | 姜大师 · 草本 | 幸福2号 | LEKASI-XF2-180 |
| 4 | 双面控 | 幸福1号 | LEKASI-XF1-180 |
| 5 | 零压 · 深睡 | 幸福99床垫 | LEKASI-XF99-180 |
| 6 | “卷”起来 | 505压缩卷包床垫 | LEKASI-505-180 |
| 7 | 次卧 · 不次等 | 323特制版床垫 | LEKASI-323-180 |
| 8 | 薄垫 · 不薄待 | 9M 卷绵特制床垫 | LEKASI-9M-180 |

banner / 文章 / 品牌信息内容沿用 BE-08 版（2 banner 覆盖 jump_type=2/3；2 文章 service+news；1 品牌行 join_phone=4008001234）。

## 4. Verify 实测记录

### 4.1 迁移与库表（verify 第 1 项）— PASS

宿主执行（容器 mysql 映射 13306）：

```bash
cd backend && DB_HOST=127.0.0.1 DB_PORT=13306 .venv/bin/alembic upgrade head
# 输出：Running upgrade a3f7c9d21e05 -> be10cat2f7a1, be10 category subtitle and banner image
```

MySQL 复核：

```
mysql> SHOW COLUMNS FROM gin_product_category;
subtitle      varchar(100)  YES  NULL
banner_image  varchar(255)  YES  NULL
mysql> SELECT version_num FROM alembic_version;  -> be10cat2f7a1
mysql> SELECT COUNT(*) FROM gin_product_category; -> 8
mysql> SELECT COUNT(*) FROM gin_product;          -> 8
```

### 4.2 pytest（verify 全量 + 干净库单跑）— PASS

全量（先 `rm -f backend/test.db`，junit 计数）：

```
tests: 139  failures: 0  errors: 0  skipped: 1  time: 25.1s
SKIPPED [1] tests/test_core_functionality.py:185: Sensitive word filter dependencies not available
```
（= 138 passed；skip 为基座既有项，与 BE-10 无关）

干净库（每个文件前 `rm -f backend/test.db`，逐个执行）：

| 文件 | tests | failures | errors |
|---|---|---|---|
| tests/test_wxapi_content.py | 26 | 0 | 0 |
| tests/test_admin_content.py | 28 | 0 | 0 |
| tests/test_business_models.py | 6 | 0 | 0 |
| tests/test_wxapi_schemes.py | 34 | 0 | 0 |

### 4.3 `/wxapi/categories`（verify 第 2 项）— PASS

```json
{"code":200,"data":[
 {"id":1,"name":"6S专属床垫","subtitle":"六大专属　分龄深睡","icon":"/uploads/demo/category-6s.png","banner_image":null,"sort":1},
 {"id":2,"name":"手工 · 零胶虑","subtitle":"大师手作　奢睡体验","icon":"/uploads/demo/category-shougong.png","banner_image":null,"sort":2}
 ...]}
```
实测：条数 8；sort 序列 `[1,2,3,4,5,6,7,8]`；name 顺序 = 定稿顺序；8 条 subtitle 全部非空、8 条 banner_image 全 null。

### 4.4 `/wxapi/products?size=50`（verify 第 3 项）— PASS

total=8，逐条：

```json
[{"name":"3D床垫","model":"LEKASI-3D-180","spec":"1800 × 2000 mm","sleep_feel":"舒适睡感","category_name":"6S专属床垫"},
 {"name":"幸福3号","model":"LEKASI-XF3-180",...,"category_name":"手工 · 零胶虑"},
 {"name":"幸福2号","model":"LEKASI-XF2-180",...,"category_name":"姜大师 · 草本"},
 {"name":"幸福1号","model":"LEKASI-XF1-180",...,"category_name":"双面控"},
 {"name":"幸福99床垫","model":"LEKASI-XF99-180",...,"category_name":"零压 · 深睡"},
 {"name":"505压缩卷包床垫","model":"LEKASI-505-180",...,"category_name":"“卷”起来"},
 {"name":"323特制版床垫","model":"LEKASI-323-180",...,"category_name":"次卧 · 不次等"},
 {"name":"9M 卷绵特制床垫","model":"LEKASI-9M-180",...,"category_name":"薄垫 · 不薄待"}]
```
category_name 集合 = 八分类全集；spec / sleep_feel 全部一致。

### 4.5 `/wxapi/home`（verify 第 4 项）— PASS

实测 `{"banners":2,"categories":8,"services":1}`，categories 元素键集合 `['banner_image','icon','id','name','sort','subtitle']`。

### 4.6 Admin 分类页（verify 第 5 项）— 代码链路 PASS（浏览器走查留 Hermes）

- `cd backend/admin && npm run build`（= `vue-tsc --noEmit && vite build`）：**RC 0**，`✓ built in 17.17s`（仅既有 >500kB chunk warning，非 error）。
- `GET /api/v1/admin/categories`（admin JWT，token len 151）返回 8 条，首条原文：
  ```json
  {"id":1,"name":"6S专属床垫","subtitle":"六大专属　分龄深睡","icon":"/uploads/demo/category-6s.png","banner_image":null,"sort":1,"status":1,"is_preset":true,"product_count":1,"create_time":"2026-11-14T14:03:12","update_time":"2026-11-14T14:03:12"}
  ```
  8 条 `is_preset=true`、`banner_image` 全 null。
- 上传 + 回填闭环实测：`POST /api/v1/admin/upload/image`（1×1 PNG）→ `/uploads/images/ffbbc7499d0b4aaaa23723e9751c7cd2.png`；`PUT /api/v1/admin/categories/8 {"banner_image": "..."}` → 该条返回新 URL，且 `/wxapi/categories` 同步带出；随后 `PUT {"banner_image": null}` 复原，确认 8 条重新全 null（保持「本轮 seed 全走文字渲染」状态）。
- 前端弹窗交互（输入 subtitle / 点上传 / 列表缩略图渲染）未做浏览器实操走查，留 Hermes `npm run dev` 验收；TypeScript 编译与 API 契约已由 build + curl 覆盖。

## 5. seed 重建（已有库实际操作命令）

容器 `web` 无源码 bind mount（`docker inspect` Mounts 为空），改代码后须重建；seed 幂等条件是「`gin_product_category` 有任意行即整体跳过」，故重建演示数据必须清表。**本次执行的真实步骤（已备份）**：

```bash
# 0) 备份受影响业务表（全表 dump，含 scheme 快照）
docker compose exec -T mysql mysqldump -uroot -pmattress_root \
  --no-tablespaces --default-character-set=utf8mb4 mattress \
  gin_scheme gin_scheme_product gin_product gin_product_category \
  gin_banner gin_article gin_brand_info > /tmp/be10_backup_before_reseed.sql
# 产物 22077 bytes，8 条 INSERT

# 1) 迁移
cd backend && DB_HOST=127.0.0.1 DB_PORT=13306 .venv/bin/alembic upgrade head

# 2) 清业务表（子表→父表；不动 wx_user、不动基座系统表）
docker compose exec -T mysql mysql -uroot -pmattress_root \
  --default-character-set=utf8mb4 mattress -e "
  SET FOREIGN_KEY_CHECKS=0;
  TRUNCATE TABLE gin_scheme_product;
  TRUNCATE TABLE gin_scheme;
  TRUNCATE TABLE gin_product;
  TRUNCATE TABLE gin_product_category;
  TRUNCATE TABLE gin_banner;
  TRUNCATE TABLE gin_article;
  TRUNCATE TABLE gin_brand_info;
  SET FOREIGN_KEY_CHECKS=1;"

# 3) 写 seed
cd backend && DB_HOST=127.0.0.1 DB_PORT=13306 .venv/bin/python scripts/seed_demo_data.py
# 输出：seed 完成：分类=8 产品=8 banner=2 文章=2 品牌信息=1

# 4) 重建 api 容器（无 bind mount）
docker compose up -d --build web
# 等 /api/v1/base/health -> 200 后验证
```

回滚备份：`docker cp /tmp/be10_backup_before_reseed.sql` 进容器后 `mysql mattress < ...`（备份含旧 7 分类/7 产品数据，仅开发环境使用）。

全新建库（无历史数据）场景无需清表，直接 migration + seed 即可。

## 6. 与任务描述不符 / 需要说明的实际发现

1. **BE-06 技术债必须在本次修掉**：verify 要求「`rm backend/test.db` 后单独跑分类相关测试文件通过」，但干净库会因 `ix_gin_product_category_id` 索引名在 SQLite 全局唯一而全 ERROR（BE-06 验收已记录）。修法取 tech-debt 建议中的第二种：`gin_product.category_id` 改用 `__table_args__` 显式命名 `ix_gin_product_category_fk`。MySQL 索引名表级隔离，**不影响已建库，无新增迁移**。
2. **分类 5/6/7 副文案是单段**（「睡眠无压力」「爱上卷包床垫」「卧室就要睡好觉」），任务描述虽写「副文案用全角空格分隔两段」，但逐条定稿值只有 1/2/3/4/8 是两段。测试按逐条定稿值断言，只对上述 5 条校验全角空格，未改数据去迁就断言。
3. **`test_wxapi_content.py::TestBrand::test_brand_returns_seeded_info` 原断言 `400-800-1234` 已过期**：BE-08 验收时 Hermes 已把 seed 改为 `4008001234`（与 `^\d{6,20}$` 校验一致）但漏改该测试断言——属既有失败，与 BE-10 无关；本次 seed 重写沿用纯数字，顺手把断言改为 `4008001234`（否则全量套件不可能绿）。
4. **`test_wxapi_schemes.py` 引用了旧型号** `JM-SJ-001` / `9M-ZX-180`，V3 seed 下会 404，改为 `LEKASI-505-180` / `LEKASI-3D-180`（只改测试夹具型号字符串，未动方案业务逻辑）。
5. **预置分类名单不需要第二处维护**：`admin_content_service.PRESET_CATEGORY_NAMES` 由 `DEMO_CATEGORIES` 派生，重写 seed 即自动变成 8 条；仅注释/错误文案中的「7 大」需同步为「8 大」。
6. **本环境原本存在 1 个开发态 mock 用户（wx_user）**，未清、未改；清表只覆盖 7 张 gin_ 业务演示表。原有方案数据均为软删的测试数据，备份见 §5。

## 7. 未决问题 / 留给 Hermes

1. Admin 分类页浏览器实操走查（填 subtitle、点上传、列表缩略图/预览）——build 与 API 已实测，交互需 `npm run dev` 复看。
2. 设计侧出图后，8 条 `banner_image` 由 Admin 上传替换（本轮按定稿全 null）。
3. `docs/DB_SCHEMA.md` 中 subtitle/banner_image 的目标态描述在本次开工前已被更新（git 里为他人未提交改动），本任务未再改该文件，也未纳入本次 commit。
4. 同一工作区还有他人未提交改动（AGENTS.md / docs/CONVENTIONS.md / miniprogram/package*.json / tasks.json / 设计文档等），本次 commit 仅包含 BE-10 相关文件，未 stage 上述内容。
