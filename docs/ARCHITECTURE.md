# 架构总览

## 整体结构

```
mattress-ux/
├── miniprogram/            # 微信原生小程序（Vant Weapp）
│   ├── pages/              # 首页/分类/列表/详情/内容Feed/图文/视频/选品单/我的
│   ├── components/         # 商品卡片/参数卡片/金刚区/瀑布流
│   ├── utils/              # 请求封装/分享scene解析/格式工具
│   └── app.js              # 入口
├── backend/                # RuoYi-FastAPI 基座（fork 自 insistence/RuoYi-FastAPI）
│   ├── application/        # FastAPI 应用（若依约定目录）
│   │   ├── apps/           # admin 业务模块（商品/分类/标签/内容）
│   │   └── wxapi/          # 小程序端路由组（/wxapi/*）
│   ├── models/             # SQLAlchemy 模型（框架 sys_* + 业务 gin_*）
│   ├── admin/              # Vue3 + Element Plus 管理后台前端
│   └── docker-compose.yml  # api + mysql + redis (+ minio 可选) + admin nginx
├── scripts/e2e/            # miniprogram-automator 验收脚本（每页面一个）
├── docs/                   # 知识库
└── tasks.json              # 唯一任务队列
```

## 依赖方向规则
1. 小程序 → 只调 /wxapi/*；Admin 前端 → 调若依 admin 接口（/dev-api）。两者共用同一个 FastAPI 进程与数据库。
2. 业务模块（gin_* 表）不得 import 或修改框架表（sys_*）的模型实现细节；跨模块数据只通过 Service 层方法访问。
3. wx_user 与 sys_user 是两套独立用户体系，禁止在 wxapi 中操作 sys_user，反之亦然。
4. 搜索一律走数据层封装（先用 FULLTEXT/LIKE），禁止在视图/控制器里裸写 LIKE 拼接（为将来换 ES 留缝）。
5. UI 层（wxml → js）不直接读写数据库；一切数据经 /wxapi 接口（小程序无本地库）。

## 核心数据流
1. 商品浏览：wxapi /goods（分页/FULLTEXT 过滤）→ gin_spu/gin_sku/gin_category/gin_tag → 小程序瀑布流渲染
2. 内容带货：Admin 发布文章/视频 + 挂 gin_content_goods → wxapi /content/feed → 详情页返回关联商品
3. 选品单分享：用户建单 → wxapi /wishlist（gin_wishlist + gin_wishlist_item）→ 分享 scene=清单ID → 好友 onLoad 解析 → wxapi /wishlist/share/:id 回显只读视图
4. 登录：wx.login → code → /wxapi/auth/login（dev mock code2session）→ 查/建 wx_user → 签发 JWT（wxapi 专用，与 admin JWT 隔离）

## 待补充
- 文件存储：图片/视频先走本地上传，云存储（腾讯云 COS）接入方案待定
- 首页推荐聚合接口的缓存策略（Redis 兜底，首版可直查 DB）