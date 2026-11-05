# 技术选型决策

定稿依据：仓库根 `技术选型.md`（2026-11-05 重定稿），本次取代此前「原生小程序 + RuoYi-FastAPI」方案。旧基座已清理，历史见 git log `ca1f035..8c80216`。

| 选型 | 原因 | 替代方案 | 注意事项 |
|------|------|---------|---------|
| 小程序 C端：Uni-app + Vue3 + TS + Pinia | 单仓覆盖多端可能；生态与既有项目同栈；小兔鲜儿 (uniapp-shop-vue3-ts) 提供请求封装/SKU 选择器/商品卡片可参考 | 微信原生 + Vant Weapp（旧案，弃：多清单对比状态管理弱） | 多清单选品状态必须 Pinia（useSelectionStore），严禁 uni.setStorageSync/全局变量跨页传选品数据；商用前查小兔鲜儿 License（仅 MIT/Apache-2.0 可复制） |
| 后端：FastAPI + SQLModel + MySQL8 + Redis | SQLModel 与 Pydantic/FastAPI 同源，Schema 单一来源；MySQL8 FULLTEXT ngram 够用；Redis 承载 token/缓存/arq | Tortoise ORM + PostgreSQL（FastAPI-Template 官方栈，不采用）；RuoYi-FastAPI（旧案，弃：2755 文件重、代码生成器产物难维护） | 参考基座 JiayuXu0/FastAPI-Template 官方为 Tortoise+PG，与本项目定稿不符 → **只复用其 Router → Service → Repository 分层、RBAC、JWT、arq 设计与代码，ORM 层按定稿自建 SQLModel + MySQL8**（asyncmy 驱动）；基座表与业务表 gin_ 前缀隔离 |
| 管理后台 B端：Vue3 + Element Plus + Vite（不套模板，CC 生成） | 基于后端 Swagger/Schema 直接生成 CRUD，代码风格 100% 统一 | RuoYi 自带 admin（随旧基座弃） | 图片上传阿里云 OSS、富文本 wangEditor（技术选型.md SOP）；el-table/el-dialog 为基础组件 |
| MySQL 8（FULLTEXT ngram） | 初期数据量小，LIKE/FULLTEXT 足够；避免过早引入 ES 运维成本 | Elasticsearch（>10 万行再评估） | ngram 中文分词需建表时配置 parser |
| Redis + arq 异步队列 | token/缓存顺手复用；海报生成等耗时任务必须异步，避免阻塞 async 路由 | 无 | async 路由禁同步库（requests/time.sleep/同步 Pillow），外部调用一律 httpx.AsyncClient |
| 单 FastAPI 服务双路由（/wxapi + /api/v1 admin） | 一套部署、一套模型，运维成本最低 | 拆两个服务（流量增长后再拆） | 鉴权必须区分：admin JWT vs wxapi JWT |
| 微信原生能力（scene 分享、code2session） | 官方链路，无第三方依赖 | 第三方登录 SDK（不必要） | scene ≤32 字符；真实 wx API 在 dev 必须 mock |

## 待补充
- 商品图片/视频云存储：技术选型.md SOP 指定阿里云 OSS（待账号/桶确认）
- 部署目标机器规格（腾讯云轻量 2C4G 为前提假设）
