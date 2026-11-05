# BE-02 DB_SCHEMA.md + SQLModel 业务模型（V2.0：方案+快照）— Sprint Output

- 任务：BE-02（tasks.json，priority=high，blocked_by NG-01 已解除）
- 执行：CC 1 个会话（deepseek-v4-flash），撞 60 轮上限退出，sprint_output 由 Hermes 补写
- 状态：submitted → Hermes 复跑验收

## 变更内容（CC 产出 4 个分步提交）

- `0bb13c8`：接入 alembic 迁移链（backend/alembic.ini + migrations/env.py + script.py.mako + 首个迁移 20261105_61798386a738_be02_business_tables.py，仅纳管 gin_/wx_ 业务表）；pyproject.toml +1 依赖
- `1b8c406`：演示 seed（backend/scripts/seed_demo_data.py 宿主入口 + backend/src/utils/demo_seed.py 幂等 seed 逻辑，含 7 分类/7 产品/2 banner/2 文章/1 品牌信息）
- `298d68d`：业务模型 + seed 冒烟测试（backend/tests/test_business_models.py 6 用例）与 sqlite 兼容修复（models/base.py BigIntPK/LongText 方言回落、models/product.py 调整）
- `b526515`：仓库根 DB_SCHEMA.md（8 业务表权威结构文档，12503 字节）

## 验证结果（Hermes 独立复跑，2026-11-05 21:23~21:33）

| # | verify 项 | 命令 | 结果 |
|---|---|---|---|
| 1 | python -c 导入全部 models | `.venv/bin/python -c "import models.product, models.scheme, models.wx_user, models.content, models.admin ..."` | all models import OK（GinProduct/GinProductCategory/GinScheme/GinSchemeProduct/WxUser/GinBanner/GinArticle/GinBrandInfo 全部可导入） |
| 2 | alembic 迁移后表清单=8 且全部 gin_/wx_ 前缀 | `docker exec mattress_mysql ... "SHOW TABLES"` | 8 张：gin_article, gin_banner, gin_brand_info, gin_product, gin_product_category, gin_scheme, gin_scheme_product, wx_user（基座表 api/dept/menu/role/user 等未动，alembic_version 已建） |
| 3 | seed 后分类数=7、产品数≥6 | `SELECT (SELECT COUNT(*) FROM gin_product_category), ... FROM ...` | cat=7, prod=7, ban=2, art=2, brand=1（全达标；seed 幂等跳过逻辑已验证：二次执行走 skipped 分支） |
| 4 | wx_user.openid 唯一索引 | `SHOW CREATE TABLE wx_user` | `UNIQUE KEY ix_wx_user_openid (openid)` ✓ |
| 5 | pytest 冒烟 | `.venv/bin/python -m pytest tests/ --tb=no -q` | 38 collect → 37 pass + 1 skip（敏感词依赖缺失，模板自带），exit 0；test_business_models.py 单独跑 6/6 pass |

## 遗留风险 / 已知问题

- 模型文件名：wx_user 单独在 `models/wx_user.py`（无 models/user.py），符合分表约定
- BigIntPK / LongText 双方言：生产 MySQL 用 BIGINT/LONGTEXT，测试 sqlite 回落 Integer/TEXT，无影响
- CC 未写本 sprint_output（撞轮次），已由 Hermes 复跑后补写

## 结论

**approved**。全部 5 项 verify 通过，BE-02 置 done，解锁 BE-04/BE-05（wxapi 登录与产品接口）。
