# BE-06 Sprint Output — wxapi 方案 CRUD + 快照 + 分享（V2.0 核心）

状态：**submitted**（待 Hermes 复跑验收）
提交：`78618f7 feat(wxapi): BE-06 方案 CRUD+快照固化+分享...`（实现+测试同 commit）
日期：2026-11-05

## 1. 交付内容

### 新增文件
| 文件 | 说明 |
|------|------|
| `backend/src/schemas/wx_scheme.py` | 入参/出参 Schema（public 出参物理上无 user_id/openid 字段，非 exclude 遮蔽） |
| `backend/src/repositories/wx_scheme.py` | 数据访问层（软删除过滤、分页、快照行替换、share_count 原子自增） |
| `backend/src/services/wx_scheme_service.py` | 业务编排（快照固化、去重保序、域异常 404/403、owner 校验） |
| `backend/src/api/v1/wxapi/schemes.py` | 7 个端点路由（挂 `/api/v1/wxapi/schemes*`） |
| `backend/migrations/versions/20261105_a3f7c9d21e05_be06_scheme_soft_delete.py` | gin_scheme 增加 `deleted_at` 软删除列 + 索引 |
| `backend/tests/test_wxapi_schemes.py` | 34 条测试（8 个测试类） |

### 修改文件
- `backend/src/models/scheme.py`：GinScheme 增加 `deleted_at: NaiveDatetime | None`（index，NULL=未删除）。模型原无 status/deleted 列，按任务指示新增软删除列并走 alembic 迁移。
- `backend/src/api/v1/wxapi/__init__.py`：挂载 schemes_router（prefix=/schemes）。

### 端点清单（除 public 外均需 wxapi JWT，DependWxAuth 复用 BE-04）
1. `POST /wxapi/schemes` — 创建方案 + 逐产品固化 JSON 快照（单事务，产品缺失 404 且整体回滚不留半成品；product_ids 去重保序；title 1-100 字 Pydantic 422 兜底）
2. `PUT /wxapi/schemes/{id}` — 仅创建者（403），整体替换：删旧快照行 → 按产品**当前**状态重新固化 → 更新 title/remark/product_count
3. `GET /wxapi/schemes` — 当前用户方案，create_time desc 分页（page/size，size>50 → 422），软删除不出现；列表项含 cover_image（首快照 main_image，供 MP-05 卡片）
4. `GET /wxapi/schemes/{id}` — 仅创建者（403），含完整快照列表（按 sort 排序）
5. `GET /wxapi/schemes/{id}/public` — 匿名只读回显；软删除/不存在 404；返回 nickname（wx_user.nickname 展示安全字段，当前 seed 用户为 null）
6. `DELETE /wxapi/schemes/{id}` — 软删除（置 deleted_at），仅创建者（403）；行与快照行保留供 BE-09 管理端追溯
7. `POST /wxapi/schemes/{id}/share` — share_count 原子 +1（SQL `share_count = share_count + 1`），仅创建者（403），返回自增后计数

### 快照冻结字段（12 个，aaa.md §4.3.1 + 产品卡片/详情渲染所需）
`id, category_id, category_name, name, model, slogan, spec, sleep_feel, main_image, detail_images, real_images, detail_content`

### 关键决策/假设
- **不筛上下架**：创建方案时产品只要存在即可固化快照（含已下架产品）——历史方案展示不受产品下架影响，与快照不可变语义一致；「仅不存在 → 404」按任务描述执行。
- **404 优先于 403**：方案不存在/已软删除 → 404；存在但非创建者 → 403（不泄露他人方案存在性给已登录第三方，但 owner 校验必须在存在性之后，业界常规）。
- **双用户测试**：mock code2session 固定 openid，用户 B 直接插 wx_user + `create_wx_access_token` 签 token（复用 BE-04 工具函数，未改 BE-04 代码）。
- remark 入参加 max_length=2000 边界校验（模型为 Text，防滥用）。

## 2. Verify 复跑指引

### pytest（34 条，含全部 verify 断言项）
```bash
cd backend && .venv/bin/python -m pytest tests/test_wxapi_schemes.py -q
# 全套回归：
cd backend && .venv/bin/python -m pytest tests/ -q
```
实际输出：
```
BE-06 套件：..................................   [100%]  exit=0（34 passed）
全套：.................s...................................................... [ 66%]
      .....................................                    [100%]  exit=0（109 passed, 1 skipped 为既有跳过）
```
注意：若本地遗留旧 `backend/test.db`（无 deleted_at 列），先 `rm backend/test.db` 再跑（sqlite create_all 不会 ALTER 既有表）。

verify 项 → 测试映射：
- 创建返回 id 且快照字段完整 → `TestCreateScheme::test_create_returns_id_with_complete_snapshot`
- 快照不可变（产品更新后旧方案仍旧值，owner+public 双通道）→ `TestSnapshotImmutability`（2 条）
- 非 owner PUT/DELETE 403 → `test_update_by_non_owner_403` / `test_delete_non_owner_403`（另有 detail/share 403）
- public 免登录 200 且无敏感字段（响应全文无 user_id/openid）→ `test_public_anonymous_200_without_sensitive_fields`
- share 计数 +1 → `test_share_increments_count`
- 软删除后列表不出现、public 404 → `test_list_excludes_soft_deleted` / `test_public_soft_deleted_404` / `test_delete_is_soft_and_hides_everywhere`

### curl 闭环（容器，http://localhost:8000，前缀 /api/v1）
```bash
cd backend && docker compose up -d --build web
docker compose exec web alembic upgrade head   # 61798386a738 -> a3f7c9d21e05
BASE=http://localhost:8000/api/v1
TOKEN=$(curl -s -X POST $BASE/wxapi/auth/login -H 'Content-Type: application/json' -d '{"code":"be06_eval"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")
curl -s -X POST $BASE/wxapi/schemes -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"BE-06 curl 闭环方案","product_ids":[1,2],"remark":"curl 验证"}'
curl -s $BASE/wxapi/schemes/1 -H "Authorization: Bearer $TOKEN"
curl -s $BASE/wxapi/schemes/1/public
curl -s -X POST $BASE/wxapi/schemes/1/share -H "Authorization: Bearer $TOKEN"   # x2
curl -s "$BASE/wxapi/schemes?page=1&size=5" -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE $BASE/wxapi/schemes/1 -H "Authorization: Bearer $TOKEN"
```
实际输出（2026-11-05 23:41 本机复跑）：
```
创建：{"id":1,...,"product_count":2,"share_count":0,
     "snapshot_keys":["category_id","category_name","detail_content","detail_images",
                      "id","main_image","model","name","real_images","sleep_feel","slogan","spec"]}
详情：products=[9M-ZX-180, HZ-YJ-001]（快照 model）
public：匿名 200；grep '"user_id"|"openid"' 无命中（no sensitive leak: OK）
share x2：{"share_count":1} → {"share_count":2}
列表：total=1 → 删除后 total=0；详情 404；public 404
无 token 创建 401；product_ids=[999999] 404
MySQL 复核：gin_scheme id=1 行保留，deleted_at=2026-11-05 23:41:06，share_count=2，
           gin_scheme_product 快照行 2 条保留（软删除不级联清行，供 BE-09 追溯）
```

## 3. 遗留风险 / 后续注意
1. **容器迁移是手动步骤**：docker-entrypoint.sh 不跑 `alembic upgrade head`（本次由我 exec 进容器执行）。后续 BE-07+ 部署时需同样手动迁移，或另行任务把迁移纳入 entrypoint（未擅自改动）。
2. **软删除不清快照行**：DELETE 后 gin_scheme_product 保留（BE-09 管理端追溯需要）；任务描述里「删除方案后 gin_scheme_item 级联清理」仅适用于**硬删除**路径（DB ON DELETE CASCADE 已建好），软删除刻意保留。若 Hermes 认为软删除也应清行，改 `soft_delete_scheme` 一处即可。
3. **PUT 为整体替换语义**：title/product_ids 必填（沿用 CreateIn 校验），不支持 PATCH 局部更新；MP-05 编辑页总是提交全量表单，符合前端形态。
4. **并发**：share 计数用 SQL 原子自增无竞态；同一方案并发 PUT 后写覆盖先写（无乐观锁版本号），当前 B 端单用户操作场景可接受。
5. 测试会清空并重建 seed 业务数据（sqlite 独立 test.db，不碰容器 MySQL）。

## 4. 范围守护
未动：BE-04 鉴权代码、BE-05 内容接口、admin 路由、backend/admin/、tasks.json（仅改状态字段）、AGENTS.md、jp/、figma-exports/、根部中文名文件、CLAUDE.md。未实现海报/arq（BE-07）与管理端方案管理（BE-09）。

---

## Evaluator 复跑评审（Hermes，2026-11-06 00:10）

**背景**：BE-06 CC 撞 60 轮上限退出，但代码/测试/sprint_output/置 submitted 已完整落地（78618f7，正是 skill 预期的"撞轮次但已完成"形态），Hermes 直接复跑验收，无需重派。

**⚠️ 验收中发现的测试地基债务（BE-02 遗留，非 BE-06 回归）**：
- `rm -f backend/test.db` 后单独跑 test_wxapi_schemes.py 报 `OperationalError: index ix_gin_product_category_id already exists`（34 条全 ERROR）
- 根因：`models/base.py` 的 `BaseModel.id` 用 `Field(primary_key=True, index=True)` → 每表生成 `ix_<table>_id`；`gin_product.category_id` 也 `index=True` → 生成 `ix_gin_product_category_id`，与 `gin_product_category` 表的 `ix_gin_product_category_id` **在 SQLite 索引名库级全局唯一**下撞名（MySQL 索引名表级隔离不撞，故容器迁移/生产无感，pytest 全量绿也是因为旧 test.db 的 checkfirst 跳过了建表）
- 修法（后续任务）：去掉 BaseModel.id 的冗余 index=True（主键本身有索引），或 gin_product.category_id 改用显式命名索引。记入 tech-debt-tracker 或并入 BE-08/09 时顺手修

**验收项逐条复跑（MySQL 容器 http://localhost:8000，真机链路）**：

| # | verify 项 | 结果 |
|---|---|---|
| 1 | pytest 全量（REAL exit code） | exit=0，109 passed + 1 skip（既有），BE-06 34/34 含在内 |
| 2 | 创建返回 id + 快照字段完整 | POST /schemes (product_ids=[1,2]) → id=2, product_count=2, snapshot 12 字段齐（含 name/model/spec/sleep_feel） |
| 3 | 快照不可变（核心不变量） | 改 gin_product name → 再查方案快照仍是旧名「9M 尊享特制床垫」✓（owner 通道实测）；pytest TestSnapshotImmutability 双通道覆盖 |
| 4 | public 匿名 200 无敏感字段 | GET /schemes/2/public 免 token 200，响应全文无 openid/user_id（schema 物理层无字段，非 exclude） |
| 5 | share 计数 +1 | POST /share ×2 → share_count 1 → 2（SQL 原子自增） |
| 6 | 软删除闭环 | DELETE 200 → 列表 total 1→0；public 404；MySQL 复核行保留 deleted_at，快照行未级联（BE-09 追溯用） |
| 7 | 越权 403 | 无 token PUT 401；非 owner PUT/DELETE → pytest 403 用例覆盖（test_update_by_non_owner_403 / test_delete_non_owner_403） |

（验收用方案 id=2 已软删除清理，未留脏数据。）

结论：**approved**。BE-06 置 done。BE-06 功能链路（创建→快照固化→分享→软删除→public 回显）端到端符合 aaa.md §4.3.1。遗留：①sqlite 测试索引撞名（BE-02 债务，上面已给出修法）②容器迁移仍是手动 alembic（CC 已记风险 1）。
