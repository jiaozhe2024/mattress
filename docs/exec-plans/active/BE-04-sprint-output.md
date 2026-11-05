# BE-04 Sprint Output — wxapi 登录与用户体系（submitted，待 Hermes 验收）

日期：2026-11-05 ｜ 执行：CC ｜ 状态：submitted（未自评，未置 done）

## 一、交付内容

### 新增文件
| 文件 | 说明 |
|------|------|
| `backend/src/schemas/wx_auth.py` | wxapi 专用 Schema：WxLoginRequest/WxRefreshRequest/WxUserOut/WxTokenOut/WxJWTPayload（载荷字段 wx_user_id+scope=wxapi，与 admin 的 JWTPayload 物理隔离） |
| `backend/src/utils/wx_jwt.py` | wxapi 独立 JWT：签名密钥 `WX_JWT_SECRET_KEY`（≠ admin SECRET_KEY），token_type=`wx_access`/`wx_refresh`（≠ admin `access`/`refresh`），scope 强制校验 |
| `backend/src/services/wechat_service.py` | code2session：`httpx.AsyncClient`（10s 显式超时，符合异步红线 #8）；`WX_CODE2SESSION_MOCK=true` 时走 mock（固定测试 openid，核心约定 #4）；真实分支解析 errcode/openid |
| `backend/src/services/wx_auth_service.py` | 登录编排：code → openid → 查/建 wx_user → 状态校验（禁用 403）→ touch last_login_at → 签发 7 天 token 对 |
| `backend/src/repositories/wx_user.py` | wx_user 仓储（get_by_openid / get_or_create_by_openid 并发 IntegrityError 回查兜底 / touch_last_login）。**只操作 WxUser 模型，不 import models.admin** |
| `backend/src/core/wx_dependency.py` | wxapi Bearer 依赖 `DependWxAuth`：独立 HTTPBearer scheme + WX 密钥/scope/token_type 三重校验，只查 wx_user 表 |
| `backend/src/api/v1/wxapi/` | 路由组：`POST /wxapi/auth/login`、`POST /wxapi/auth/refresh`、`GET /wxapi/users/me` |
| `backend/tests/test_wxapi_auth.py` | 12 个用例（先写测试 RED → 实现 GREEN，TDD） |

### 修改文件
- `backend/src/settings/config.py`：WX_* 配置块 + `WX_JWT_SECRET_KEY` 空值回落/长度校验 + 生产校验（生产禁 mock、必须配 WX_APPID/WX_SECRET、必须覆盖 WX_JWT_SECRET_KEY）
- `backend/src/api/v1/__init__.py`：挂载 wxapi_router（prefix=/wxapi，**不挂** admin 的 DependAuth/DependPermisson）
- `backend/src/core/init_app.py`：审计日志 exclude `/api/v1/wxapi`（避免 login 响应 token/wx code 落 AuditLog；匿名请求无操作人可归属）
- `backend/.env.example`：WX_* 示例（`.env` 本地同步，未跟踪不提交）

### Mock 规则（dev/自动化）
- `WX_CODE2SESSION_MOCK=true`（默认）：任意非空 code → 固定 openid `WX_MOCK_OPENID`（默认 `mock_openid_wxtest_001`）；code == `WX_MOCK_INVALID_CODE`（默认 `invalid_code`）→ 模拟微信 errcode 40029 → 401
- 生产：`WX_CODE2SESSION_MOCK=false` + 真实 `WX_APPID`/`WX_SECRET`（config 生产校验强制）

## 二、Verify 复跑命令与真实输出

### 1. pytest（backend/.venv）
```
$ cd backend && .venv/bin/python -m pytest tests/test_wxapi_auth.py -q
............                                                             [100%]
（12 passed：登录返回 token/二次登录不重复建用户/非法 code 401/空 code 422/
 禁用用户 403/refresh 换新 token+access 不能当 refresh 用/users.me 200 字段齐/
 无 token 401/垃圾 token 401/wx token 打 admin 401/admin token 打 wxapi 401/
 wx 登录不写后台 User 表）

$ .venv/bin/python -m pytest tests/ -q        # 全量
50 passed, 1 skipped in 1.60s                  # skip 为 BE-01 前已有的敏感词依赖缺失，非本任务引入
```

### 2. curl（容器 mattress_api，http://localhost:8000，2026-11-05 实测）
```
$ docker compose up -d --build web   # 重建后 health=200

# ① 登录（mock code2session）→ 200 + token
$ curl -s -X POST http://localhost:8000/api/v1/wxapi/auth/login \
    -H 'Content-Type: application/json' -d '{"code":"curl_test_code"}'
{"code":200,"msg":"OK","data":{"access_token":"eyJ...XJT10","refresh_token":"eyJ...KBqJUoTcHRerxW6b...
 （payload 解码：{"wx_user_id":1,"exp":...,"token_type":"wx_access","scope":"wxapi"}）

# ② 同 code 二次登录 → user.id 均为 1，不重复建用户
uid1=1 uid2=1 same=YES

# ③ 非法 code → 401
$ curl ... -d '{"code":"invalid_code"}'   → status=401

# ④ GET /wxapi/users/me 带 wx token → 200
{"code":200,"msg":"OK","data":{"id":1,"openid":"mock_openid_wxtest_001","nickname":null,
 "avatar":null,"status":1,"last_login_at":"2026-11-05T22:05:54"}}  status=200

# ⑤ wx token 打 admin /base/userinfo → 401（互不通用）
status=401
# ⑥ admin token（/base/access_token, admin/abcd1234）打 /wxapi/users/me → 401（互不通用）
status=401
```

### 3. 分表核验（MySQL 容器内）
```
$ docker exec mattress_mysql mysql -umattress -p*** mattress -e \
  "SELECT id,openid,status,last_login_at FROM wx_user; SELECT COUNT(*) FROM user;"
id=1  openid=mock_openid_wxtest_001  status=1  last_login_at=2026-11-05 22:05:54
admin_user_count=1        # 仅 seed 的 admin，wx 登录零写入后台用户表
```

## 三、自我批判 / 遗留风险
1. **mock 只有单 openid**：mock 模式所有合法 code 归一到固定 openid（核心约定 #4 的要求），dev 环境多用户场景（BE-06 方案越权测试）需直接经 repository 造 wx_user，或后续给 mock 增加 code→openid 派生规则。
2. **无 token 吊销/黑名单**：7 天长 token 签发后不可主动作废；后台禁用用户依赖 `DependWxAuth` 每次查库的 status 校验兜底（已实现，禁用即刻 403）。
3. **session_key 未持久化**：code2session 返回的 session_key 当前丢弃（V2.0 无手机号解密等需求）；如后续需要，勿明文落库。
4. **wxapi 路由会进入基座 Api 表**：init_apis 的 refresh_api 扫描全部路由，wxapi 三条会入 Api 表并被关联给管理员角色——不影响鉴权（wxapi 路由组未挂 RBAC 依赖），仅 Admin API 管理页可见，属基座既有行为。
5. **限流**：/wxapi/auth/login 未挂 slowapi 限流（admin 的 access_token 有 5/minute）。小程序端静默登录频率低，风险可接受；如需加固可在 BE-06 前补 `apply_rate_limit`。
6. `WX_JWT_SECRET_KEY` 生产必须覆盖（config 已有生产校验拦截默认值），部署清单需带上。

## 四、范围外确认
- 未实现产品/首页/banner/资讯/品牌接口（BE-05 范围）
- 未动 backend/admin/（BE-03 交付物）、未动 wx_user 模型、未动 admin JWT 体系
- tasks.json BE-04 → submitted（由 Hermes 验收后置 done）

---

## Evaluator 复跑评审（Hermes，2026-11-05）

独立复跑（后端容器四件套 healthy，localhost:8000）：

| # | verify 项 | 命令 | 结果 |
|---|---|---|---|
| 1 | pytest 冒烟 | `.venv/bin/python -m pytest tests/ --tb=no -q` | exit 0；test_wxapi_auth.py 12/12 通过（`............` [100%]） |
| 2 | mock 登录返 token | `POST /wxapi/auth/login (code=hermes_eval_1)` | 200 `{code:200,data:{access_token:eyJ...}}`，token_len=180 |
| 3 | 非法 code 401 | `POST /wxapi/auth/login (code=invalid_code)` | HTTP 401 ✓ |
| 4 | users/me 200 | `GET /wxapi/users/me` + Bearer | 200 `{id:1, openid:"mock_openid_wxtest_001", status:1, last_login_at}` ✓ |
| 5a | wx token 打 admin 端点 | `GET /base/userinfo` + wx token | 401 ✓（互不通用） |
| 5b | admin token 打 wxapi 端点 | `GET /wxapi/users/me` + admin token | 401 ✓（互不通用） |
| 6 | 二次登录不重复建用户 | 同一 session 内 4 次登录（hermes_eval_1/hermes_eval_2×2）+ MySQL `SELECT COUNT(*) FROM wx_user` | **wx_user=1 行**（4 次登录仅 1 用户，幂等成立） |
| 7 | wx_user 无后台混写 | MySQL `SELECT COUNT(*) FROM user` | **1 行**（仅 seed admin，wx 登录零写入后台表） |

注：CC curl 返回信封内还有 `data.id`/`data.user_id`，我探针误取顶层 `id` 报 KeyError——探针问题非代码问题，改用表计数验证等价成立。

CC 自述输出（登录/去重/401/users.me/双向隔离/分表 7 项）+ Hermes 独立复跑 7 项，全部一致。

结论：**approved**。BE-04 置 done，BE-05（wxapi 产品/首页聚合/资讯/品牌接口，blocked_by BE-02 已满足）解锁。遗留风险（单 mock openid、无 token 吊销、login 无限流、session_key 未持久化）已记录在上文第三节，均可接受，BE-06 前如需多用户方案用例再考虑扩展 mock。
