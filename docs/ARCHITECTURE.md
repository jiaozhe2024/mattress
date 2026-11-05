# 架构总览（V2.0）

## 整体结构

```
mattress-ux/
├── miniprogram/            # Uni-app (Vue3 + TS + Pinia) 小程序，编译到微信小程序
│   ├── src/pages/          # 首页/产品列表/产品详情/方案编辑/方案列表/方案预览/个人中心
│   ├── src/components/     # 产品卡片/悬浮选款按钮/底部已选栏（参考小兔鲜儿）
│   ├── src/stores/         # Pinia 状态（useSelectionStore 等）
│   ├── src/utils/          # request 封装/token 管理/格式工具
│   └── dist/               # mp-weixin 构建产物（gitignore；DevTools 打开此处）
├── backend/                # FastAPI + SQLModel + MySQL8 + Redis（参考 JiayuXu0/FastAPI-Template 分层）
│   ├── src/api/            # 路由层：api/v1（admin 业务）+ api/wxapi（小程序端）
│   ├── src/services/       # 业务逻辑层
│   ├── src/repositories/   # 数据访问层（搜索封装在此）
│   ├── src/models/         # SQLModel 模型（基座表 + 业务 gin_*）
│   ├── src/worker/         # arq 异步任务（海报生成等）
│   ├── admin/              # Vue3 + Element Plus + Vite 管理后台（CC 生成，不套模板）
│   └── docker-compose.yml  # mysql8 + redis + api + worker
├── scripts/e2e/            # miniprogram-automator 验收脚本（每页面一个）
├── docs/                   # 知识库（规格权威源 = 仓库根 aaa.md）
└── tasks.json              # 唯一任务队列
```

## 依赖方向规则
1. 小程序 → 只调 `/wxapi/*`；Admin 前端 → 调 `/api/v1/*`。两者共用同一个 FastAPI 进程与数据库。
2. 业务模块（gin_* 表）不得 import 或修改基座框架表的模型实现细节；跨模块数据只通过 Service 层方法访问。
3. wx_user 与后台用户表是两套独立用户体系，禁止在 wxapi 中操作后台用户表，反之亦然。
4. 搜索一律走 Repository 层封装（先用 FULLTEXT/LIKE），禁止在路由/服务层裸写 LIKE 拼接。
5. UI 层不直接读写数据库；一切数据经 /wxapi 接口。选品/方案状态只经 Pinia store 流转。
6. async 路由严禁同步阻塞调用（requests/time.sleep/同步 Pillow）；外部调用用 httpx.AsyncClient，耗时任务（海报生成）入 arq 队列。

## 核心数据流（V2.0）
1. 产品浏览：wxapi /products（分页/分类/关键词/排序）→ gin_product/gin_product_category → 小程序列表页/详情页
2. 方案创建：导购勾选产品（Pinia useSelectionStore）→ 方案编辑页 → POST /wxapi/schemes → 创建方案主记录 + 每产品快照 JSON（gin_scheme_product）→ 方案列表/预览页
3. 方案分享：预览页分享 → 小程序卡片 path=`/pages/scheme/preview?id={scheme_id}` → 好友点击 → GET /wxapi/schemes/{id}/public（免登录只读回显）→ 分享计数 POST /wxapi/schemes/{id}/share；长图海报由 arq worker 异步生成
4. 登录：wx.login → code → /wxapi/auth/login（dev mock code2session）→ 查/建 wx_user → 签发 JWT（wxapi 专用，与 admin JWT 隔离）

## 待补充
- 文件存储：图片/视频走阿里云 OSS / 腾讯云 COS，账号/桶与上传凭证方案待定
- 首页聚合接口（banners/categories/services）缓存策略（Redis 兜底，首版可直查 DB）