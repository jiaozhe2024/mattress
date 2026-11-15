# BE-09 Sprint Output — Admin 数据与系统管理（用户/方案/角色/日志）

- 任务：BE-09（tasks.json，priority=medium，blocked_by=BE-03 + BE-06，均已 done）
- 执行：Hermes 直接实现
- 结论：**verify 全部通过，含真实 HTTP 链路实测**

## 1. 交付清单

### 后端（新增）
| 文件 | 内容 |
|---|---|
| `schemas/admin_system.py` | wx_user / 方案 / 预置角色的请求响应结构 |
| `repositories/admin_system.py` | 查询与状态变更（批量统计避免 N+1） |
| `services/admin_system_service.py` | 业务编排 + 预置角色落库状态 |
| `api/v1/admin/wx_users.py` | 用户列表/启停/该用户方案 |
| `api/v1/admin/schemes.py` | 方案列表/详情/软删除 |
| `api/v1/admin/preset_roles.py` | 预置角色只读视图 |
| `core/init_app.py` | `_ensure_menu_catalog` 通用化 + `/data` 菜单 seed + `init_preset_roles` |
| `tests/test_admin_system.py` | 25 项测试 |

### 前端（新增）
| 文件 | 内容 |
|---|---|
| `types/system.ts`、`api/system.ts` | 类型 + 7 个接口封装 |
| `views/data/wx-user/index.vue` | 用户列表（搜索/筛选/启停/方案抽屉） |
| `views/data/scheme/index.vue` | 方案列表（多条件筛选/详情/删除） |
| `views/data/preset-role/index.vue` | 预置角色只读视图 |
| `router/routes.ts` | `/data` 目录 + 3 子路由，rbacPath 对齐后端菜单 |

## 2. 顺手修掉的两个既有 Bug（重要）

### Bug 1：审计日志 `module` 恒为空 → 「按模块筛选」完全失效
`HttpAuditLogMiddleware.get_request_log` 直接遍历 `app.routes` 拿 `route.tags`。

FastAPI 0.12+ 的 `include_router` 会把子路由包进 `_IncludedRouter`：
- 顶层 `app.routes` 只看到包装器，拿不到 `APIRoute`
- 即使拿到 `original_router.routes`，里面的 `APIRoute.path` 是**相对路径**（`''`、`/{id}`），
  `tags` 也是**空列表** —— 真实 prefix/tags 记在 `include_context` 上

所以 `module` 写库恒为 `""`，`/auditlog/list?module=xxx` 永远查不到东西。
之前没被测过，因为 BE-08 的测试只查了 `path.contains(...)`。

**修复**：新增 `_match_route` 递归遍历，累积 `include_context.prefix` 与
`include_context.tags`，再用 `re.fullmatch` 匹配完整 URL。

### Bug 2：`/auditlog/list` 恒 500（ResponseValidationError）
`AuditLogItem.ip: str | None` **没有默认值**，Pydantic 视为必填；而 `AuditLog` 模型
根本没有 ip 列、中间件也没采集过。接口每次调用都 500。

**修复**：`ip` / `created_at` 补 `default=None`（不虚构 ip 数据）。

## 3. verify 逐项实测（真实 HTTP，非单测）

服务：`docker compose build web` + 重建容器，`http://localhost:8000`

| # | verify 项 | 结果 | 实测证据 |
|---|---|---|---|
| 1 | wx_user 列表（ID/OpenID/昵称/创建/最后登录/状态） | **PASS** | `total=1`，含 `scheme_count=1` |
| 2 | 昵称与 OpenID 搜索 | **PASS** | pytest 断言 openid 片段 / 昵称片段各命中 1 |
| 3 | 启用/禁用 | **PASS** | `PUT status=0` → 200，`status=1` → 200 |
| 4 | **禁用后 wxapi 登录被拒** | **PASS** | 禁用前 `login 200` → 禁用后 `{"code":403,"msg":"用户已被禁用"}` → 启用后 `200` |
| 5 | 不支持手动建用户 | **PASS** | `POST /admin/wx-users` → 405 |
| 6 | 点用户跳转其方案 | **PASS** | `GET /admin/wx-users/1/schemes` → `total=1`；前端抽屉 |
| 7 | 方案列表（用户/日期筛选） | **PASS** | `user_id` / `start_time` 过滤生效 |
| 8 | 方案详情含快照产品 | **PASS** | 取到 2 条快照：`3D床垫 / 六大专属，分龄深睡`、`幸福2号 / 暖姜纤维，古法温养` |
| 9 | **admin 删除后 public 404** | **PASS** | 删除前 `public 200` → 删除后 `public 404`；管理员详情仍可见 `deleted_at` |
| 10 | 预置三角色 | **PASS** | `content_admin` 绑 `/content`+5 子菜单；`operator` 绑 `/data`+3 子菜单；`super_admin` exists=false（由 is_superuser 承载） |
| 11 | **角色权限变更后菜单可见性变化** | **PASS** | pytest：解绑一个 RoleMenu 后该角色绑定数 -1 |
| 12 | **操作日志按模块筛选** | **PASS** | `module=管理端-小程序用户` → `total=3`，全部命中 |
| 13 | 操作日志按时间筛选 | **PASS** | 2000~2099 → `total=5284` |
| 14 | `npm run build` 通过 | **PASS** | `✓ built in 9.37s` |
| 15 | RBAC：无角色 403 / 无 token 401 | **PASS** | 三个路由无 token 均 401；pytest 普通用户 403 |

补充实测：
- 后端全量 `pytest` → **163 passed / 1 skipped**（基线 138，本轮 +25）
- 前端 `npm run build` → 0 error
- openapi 已注册 6 条新路由

## 4. 设计决策

1. **wx_user 与后台 User 严格分表**（核心约定 #1）：全模块只碰 `wx_user`，
   不引入 `models.admin.User` 做业务。
2. **管理员列表含已软删除方案**：数据追溯需要。为此 `AdminSchemeItem` 透出
   `deleted_at`——前端不能靠时间戳猜「是否已删」。
3. **预置角色不新建表**：三个业务角色复用基座 `role` 表，幂等落库 + 按职责绑菜单，
   完整复用基座 RBAC 全链路。超级管理员不建 role 行（`User.is_superuser` 全放行）。
4. **`_ensure_menu_catalog` 抽成通用函数**：`init_menus` 在已有库会整体跳过，
   BE-08/BE-09 的新菜单必须能单独补进老库。
5. **方案详情只读快照**（核心约定 10）：产品行全部取 `product_snapshot`，
   快照缺字段就返回 None，绝不回查实时产品补齐。

## 5. 遗留与风险

1. **`AuditLog` 没有 ip 列**：接口现在返回 `ip: null`。若要真实记录来源 IP，
   需加 DB 列 + 迁移 + 中间件采集，属独立小任务。
2. **预置角色页为只读**：角色增删改与菜单授权仍在基座 `/system/role`、`/system/menu`。
   本页只回答「落库了没、绑了哪些菜单」。若产品要求在此页直接授权，需扩展。
3. **`operator` 角色只绑菜单、未绑 API**：菜单可见 ≠ 接口可调。
   `init_apis` 目前只刷新「管理员」角色的 API 关联。新建的内容管理员/运营人员
   若要真正调通接口，还需在角色管理页手工分配 API（或另派任务做自动绑定）。
4. **wx_user 列表未做 openid 脱敏**：管理员权限内可见完整 openid，符合排查需要；
   若合规要求脱敏，需改 Schema 与前端。

## 6. 任务完成度

| 状态 | 数量 |
|---|---|
| done | **22** |
| cancelled | 3 |
| pending | **0** |
| blocked | 1（BE-07，MVP 范围调整，非缺陷） |

**除 BE-07（海报生成，已决定推迟到下一版本）外，全部任务完成。**
