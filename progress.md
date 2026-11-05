# 项目进度记录

> 每次 session 完成任务后在顶部追加，不删历史。格式：## [日期] [任务名]

---

## 2026-11-05 BE-05 wxapi 产品/首页聚合/资讯/品牌接口（submitted，待验收）
- 新增 7 个匿名只读 GET（/api/v1/wxapi/*）：home 聚合（banners+categories+services）、categories、products 列表（page/size≤50、category_id、keyword、sort=comprehensive|newest）、products/{id} 详情（富文本+detail_images/real_images JSON，下架 404）、articles 列表（可过滤 news/service）、articles/{id}（下线 404）、brand 单行配置
- 分层：repositories/wx_content.py（关键词搜索用 SQLAlchemy contains(autoescape=True) LIKE 封装 name/model/slogan/spec，无裸拼 SQL，核心约定 #3）→ services/wx_content_service.py → api/v1/wxapi/content.py；信封 {code,msg,data}，分页 data={items,total,page,size}，时间字段对外 create_time
- 契约决策：文章 category 枚举=news/service（models/enums.py ArticleCategory）；/home services=category='service' 且已发布；/brand 无数据 200+data=null；文章列表不返回富文本
- 未动 BE-04 auth 代码（wxapi/__init__.py 仅追加挂载 2 行）；复用 BE-02 模型与 demo_seed，无新表/迁移
- 验收：tests/test_wxapi_content.py 24 用例绿（全量绿，1 skipped 为基座 sensitive-word 依赖遗留）；web 容器重建后 curl 全部实测通过，含 dev 库临时下架 JM-SJ-001 → 列表 total 7→6 + 详情 404 + 恢复 200（详见 docs/exec-plans/active/BE-05-sprint-output.md）
- 遗留风险：/home 无缓存（3 次查询/请求）；%kw% LIKE 不走索引（<10 万约定内）；匿名接口未单独限流；web 容器无源码挂载需重建部署
- 详情 docs/exec-plans/active/BE-05-sprint-output.md；tasks.json BE-05 → submitted；下次：Hermes 复跑验收，MP-02/03/04/06 的 BE-05 依赖已就绪

## 2026-11-05 BE-04 wxapi 登录与用户体系（submitted，待验收）
- 新建 /api/v1/wxapi/* 路由组（与 admin 路由组物理隔离）：POST /auth/login（wx.login code → code2session → 查/建 wx_user → 7 天 token 对）、POST /auth/refresh、GET /users/me
- 独立 JWT 体系三重隔离：WX_JWT_SECRET_KEY 独立密钥 + payload（wx_user_id/scope=wxapi）+ token_type（wx_access/wx_refresh）；admin token 打 wxapi 与 wx token 打 admin 均 401（pytest+curl 双向实测）
- code2session 用 httpx.AsyncClient（异步红线），dev/测试 WX_CODE2SESSION_MOCK=true 固定 openid=mock_openid_wxtest_001，code=invalid_code 模拟 40029→401；生产校验强制关 mock + 配 WX_APPID/WX_SECRET + 覆盖密钥
- 分表红线：wx_user 仓储不 import models.admin；curl 实测登录只写 wx_user，后台 user 表计数不变；并发首登靠 openid 唯一索引 IntegrityError 回查兜底
- 验收：tests/test_wxapi_auth.py 12 用例绿，全量 50 passed/1 skipped；容器重建后 curl 7 项全过（详见 sprint-output）
- 遗留风险：mock 单 openid（BE-06 多用户需 repository 造数）；7 天 token 无吊销（禁用靠每请求 status 校验兜底）；/wxapi/auth/login 未挂限流
- 详情 docs/exec-plans/active/BE-04-sprint-output.md；tasks.json BE-04 → submitted；下次：Hermes 复跑验收，通过后可派 BE-05/BE-06（BE-06 blocked_by BE-04）

## 2026-11-05 BE-03 Admin 前端工程骨架（submitted，待验收）
- 新建 backend/admin/（Vite+Vue3+TS+Element Plus，无模板 vendor）：登录页对接基座 JWT、布局（侧边菜单+顶栏+面包屑）、路由守卫（无 token/401 跳登录）、RBAC 菜单级过滤（超管全放行；普通用户按角色 GET /role/authorized 菜单并集）、axios 统一封装（信封拆包/Bearer/错误 toast）
- 契约核验：登录成功 code200 含 access/refresh token；错密码 HTTP 400「密码错误!」；无效 token 401；dev 端口固定 8080（后端 CORS 白名单 3000/8080，3000 被占用）
- 验收：npm run build 绿；Playwright 浏览器 10 项全 PASS（无 token 跳转/错密码 toast/登录进布局/侧边栏面包屑/无效 token 清 token 回登录）；截图 /tmp/be03_dashboard.png
- 契约缺口记录：基座 /base/usermenu 被注释未启用（前端改用 role/authorized 求并集）；refresh 自动续签未做；token localStorage 明文（技术债）
- 详情 docs/exec-plans/active/BE-03-sprint-output.md；tasks.json BE-03 → submitted；下次：Hermes 复跑验收后派 BE-08/BE-09（依赖 BE-02）

## 2026-11-05 V2.0 全量重建（规格书驱动）
- 用户提供 aaa.md（技术需求规格说明书 V2.0）：产品转向 **B 端导购/经销商赋能工具**（产品展示 → 方案生成 → 微信分享），明确不做 C 端交易
- aaa.md 修正：小程序端选型由「微信原生+Vant Weapp」改回 **Uni-app+Vue3+TS+Pinia**（与仓库既有定稿一致，文档内部 Pinia/原生矛盾已消除）；同步修正 MySQL 理由（去 RuoYi 引用）、架构图、Admin 理由
- 全量重建地基（以 aaa.md V2.0 为唯一依据）：
  - 新增 docs/product-specs/PRD-v2.0.md（提炼规格）；PRD-v1.1 标记已废弃
  - TECH_DECISIONS / ARCHITECTURE / CONVENTIONS / QUALITY / business-solution / backlog / design-brief / figma-handoff 全部 V2.0 化
  - AGENTS.md 更新（权威规格=aaa.md；核心约定新增 方案快照 条款；去内容社区）
  - tasks.json 重排：数据模型 8 表（gin_product_category/gin_product/wx_user/gin_scheme/gin_scheme_product/gin_banner/gin_article/gin_brand_info）取代 V1.1 的 11 表；NG-01/BE-02~09 + MP-01~06 对齐 V2.0 页面（3 Tab 首页/产品/我的 + 方案中心编辑/列表/预览）；MP-02~06 blocked 等用户确认 jp/ 参考图
- 关键模型变更：商品无独立 SKU 表（规格内嵌字段）；「方案 Scheme + 快照 JSON」取代「选品单 wishlist」；移除内容社区（视频/内容带货不做）
- 下次从这里开始：派 CC 执行 NG-01（后端底座）与 MP-01（小程序骨架，不依赖设计稿）；BE-02 阻塞链 NG-01→BE-02→BE-04/05→BE-06→BE-07

## 2026-11-05 技术选型重定稿 + 旧基座清理 + 任务重排
- 决策：后端 FastAPI + **SQLModel** + MySQL8 + Redis（参考 JiayuXu0/FastAPI-Template 的分层/RBAC/JWT/arq，ORM 层自建，模板官方 Tortoise+PG 不采用）；管理后台 Vue3+Element Plus+Vite 由 CC 生成；小程序改 Uni-app+Vue3+TS+Pinia。依据：仓库根 技术选型.md
- 清理：backend/ RuoYi-FastAPI 旧基座 git 全量移除；ruoyi-* 四容器 + mysql/redis 卷 `docker compose down --volumes` 清空；backend/ 留占位 README
- tasks.json 重排：新增 NG-01（新基座初始化）；BE-01 → cancelled；BE-02 改 SQLModel/alembic；BE-03 改 Admin CC 生成；BE-07 附带 arq 海报队列；MP-01 改 Uni-app；MP-05 补参数对比
- 文档同步：TECH_DECISIONS / ARCHITECTURE / CONVENTIONS / PRD-v1.1 / QUALITY 全部去 RuoYi 化；AGENTS.md 技术栈与红线更新
- 下次从这里开始：派 CC 执行 NG-01（阻塞 BE-02）；或并行 MP-01（不依赖 Figma/后端）

## 2026-11-05 BE-01 后端基座初始化（RuoYi-FastAPI）
- RuoYi-FastAPI master 基座 2755 文件全量迁入 backend/（无嵌套 .git，sys_/gen_ 框架表原样，未建业务表）
- 新增 backend/docker-compose.yml（跟随上游 MySQL 版官方 compose，补 mysql/redis 持久化卷）
- 镜像构建修复：清华 pip 源本机 403 → 阿里云镜像；sqlglotc 30.23.0 仅 cp311+ 预编译轮 → 后端镜像升 Python 3.12（CI 同款），避免 25min Rust 源码编译后启动崩
- 四容器全部 Up（mysql/redis healthy）：admin 12580、api 19099、mysql 13306、redis 16379
- 验收探活全过：init.sh OK；/docker-api/captchaImage 返回 JSON；admin 登录页 200
- **端口要点：Docker 模式 API 前缀是 /docker-api（非 /dev-api，后者是本地 dev 模式）**，探活/集成测试统一用 /docker-api
- 输出：docs/exec-plans/active/BE-01-sprint-output.md；tasks.json BE-01 → submitted（待 Hermes 复跑验收）
- 下次从这里开始：Hermes 验收 BE-01；或并行开 BE-02（业务表，依赖 BE-01）/ MP-01（小程序骨架，不依赖 Figma）

## 2026-11-04 初始化 Harness（PRD V1.1 + 技术选型定稿）
- 完成 harness-step1/3：AGENTS.md、docs/ 知识库、init.sh、tasks.json、progress.md
- PRD 升级 V1.1：新增内容社区模块（图文/视频带货）；热词管理降级为 backlog
- 技术选型定稿：原生小程序+Vant Weapp / RuoYi-FastAPI 基座（详见 docs/TECH_DECISIONS.md）
- UI 流程：Designer 在 Figma 出稿（约定见 docs/design/figma-handoff.md），CC 按稿实现，Hermes 验收对照截图
- tasks.json 初始任务数：14（BE-01~07 后端线、MP-01~07 小程序线；MP-02~07 blocked 等 Figma 稿）
- 下次从这里开始：读 tasks.json，选 priority=high 且 status=pending 的任务（当前 BE-01 / MP-01），派 CC 执行，Hermes 当 Evaluator
- 待用户动作：① 微信开发者工具扫码登录一次（automator 验收前置） ② Designer Figma 稿交付 ③ 云服务器/域名预算确认