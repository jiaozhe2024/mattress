# 架构总览

## 整体结构

```
mattress-ux/
├── miniprogram/            # Uni-app (Vue3 + TS + Pinia) 小程序，编译到微信小程序
│   ├── src/pages/          # 首页/分类/列表/详情/内容Feed/图文/视频/选品单/我的
│   ├── src/components/     # 商品卡片/参数卡片/金刚区/瀑布流/SkuPopup（参考小兔鲜儿）
│   ├── src/stores/         # Pinia 状态（useSelectionStore 等）
│   ├── src/utils/          # request 封装/分享scene解析/格式工具
│   └── dist/               # mp-weixin 构建产物（gitignore；DevTools 打开此处）
├── backend/                # FastAPI + SQLModel + MySQL8 + Redis（参考 JiayuXu0/FastAPI-Template 分层）
│   ├── src/api/            # 路由层：api/v1（admin 业务）+ api/wxapi（小程序端）
│   ├── src/services/       # 业务逻辑层
│   ├── src/repositories/   # 数据访问层（搜索封装在此）
│   ├── src/models/         # SQLModel 模型（基座表 + 业务 gin_*）
│   ├── src/worker/         # arq 异步任务（海报生成等）
│   ├── admin/              # Vue3 + Element Plus + Vite 管理后台（CC 生成，不套模板）
│   └── docker-compose.yml  # mysql8 + redis + api
├── scripts/e2e/            # miniprogram-automator 验收脚本（每页面一个）
├── docs/                   # 知识库
└── tasks.json              # 唯一任务队列
```

## 依赖方向规则
1. 小程序 → 只调 /wxapi/*；Admin 前端 → 调 /api/v1/*。两者共用同一个 FastAPI 进程与数据库。
2. 业务模块（gin_* 表）不得 import 或修改基座框架表的模型实现细节；跨模块数据只通过 Service 层方法访问。
3. wx_user 与后台用户表是两套独立用户体系，禁止在 wxapi 中操作后台用户表，反之亦然。
4. 搜索一律走 Repository 层封装（先用 FULLTEXT/LIKE），禁止在路由/服务层裸写 LIKE 拼接（为将来换 ES 留缝）。
5. UI 层不直接读写数据库；一切数据经 /wxapi 接口（小程序无本地库）。多清单选品状态只经 Pinia store 流转。
6. async 路由严禁同步阻塞调用（requests/time.sleep/同步 Pillow）；外部调用用 httpx.AsyncClient，耗时任务（海报生成）入 arq 队列。

## 核心数据流
1. 商品浏览：wxapi /goods（分页/FULLTEXT 过滤）→ gin_spu/gin_sku/gin_category/gin_tag → 小程序瀑布流渲染
2. 内容带货：Admin 发布文章/视频 + 挂 gin_content_goods → wxapi /content/feed → 详情页返回关联商品
3. 选品单分享：用户建单 → wxapi /wishlist（gin_wishlist + gin_wishlist_item）→ 分享 scene=清单ID → 好友 onLoad 解析 → wxapi /wishlist/share/:id 回显只读视图；海报图由 arq worker 异步生成
4. 登录：wx.login → code → /wxapi/auth/login（dev mock code2session）→ 查/建 wx_user → 签发 JWT（wxapi 专用，与 admin JWT 隔离）

## 待补充
- 文件存储：图片/视频走阿里云 OSS（技术选型.md SOP 指定），账号/桶与上传凭证方案待定
- 首页推荐聚合接口的缓存策略（Redis 兜底，首版可直查 DB）
