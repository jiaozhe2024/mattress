# 技术选型决策（V2.0）

定稿依据：仓库根 `aaa.md`（技术需求规格说明书 V2.0，2026-11-05 定稿），取代 V1.1 方案。aaa.md §1.4 小程序端曾写「微信原生 + Vant Weapp」，与文档内部 Pinia/TS 用法矛盾，已修正回 **Uni-app + Vue3 + TS + Pinia**（与仓库既有定稿一致）。

| 选型 | 原因 | 替代方案 | 注意事项 |
|------|------|---------|---------|
| 小程序 C端：Uni-app + Vue3 + TS + Pinia | 一套代码编译到微信小程序；Vue3+TS 与 AI 生成代码契合；Pinia 支撑「多清单选品」核心逻辑；参考 小兔鲜儿 (uniapp-shop-vue3-ts) 的请求封装/商品卡片 | 微信原生 + Vant Weapp（aaa.md 早期稿案，弃：无 Pinia，多清单状态管理弱） | 选品状态必须 Pinia（useSelectionStore），严禁 uni.setStorageSync/全局变量跨页传选品数据；商用前查 小兔鲜儿 License（仅 MIT/Apache-2.0 可复制） |
| 后端：FastAPI + SQLModel + MySQL8 + Redis | SQLModel 与 Pydantic/FastAPI 同源，Schema 单一来源；MySQL8 FULLTEXT ngram 够用；Redis 承载 token/缓存/arq | Tortoise ORM + PostgreSQL（FastAPI-Template 官方栈，不采用）；RuoYi-FastAPI（旧案，弃） | 参考基座 JiayuXu0/FastAPI-Template（MIT）：只复用 Router→Service→Repository 分层、RBAC、JWT、arq 设计与代码，ORM 层按定稿自建 SQLModel + MySQL8（asyncmy 驱动）；业务表 gin_ 前缀隔离 |
| 管理后台 B端：Vue3 + Element Plus + Vite（不套模板，CC 生成） | 基于后端 Swagger/Schema 直接生成 CRUD，代码风格 100% 统一 | 无 | 图片上传阿里云 OSS、富文本 wangEditor；el-table/el-dialog 为基础组件 |
| MySQL 8（FULLTEXT ngram） | 初期数据量小，LIKE/FULLTEXT 足够；避免过早引入 ES 运维成本 | Elasticsearch（>10 万行再评估） | ngram 中文分词需建表时配置 parser |
| Redis + arq 异步队列 | token/缓存顺手复用；海报生成等耗时任务必须异步，避免阻塞 async 路由 | 无 | async 路由禁同步库（requests/time.sleep/同步 Pillow），外部调用一律 httpx.AsyncClient |
| 单 FastAPI 服务双路由（/wxapi + /api/v1 admin） | 一套部署、一套模型，运维成本最低 | 拆两个服务（流量增长后再拆） | 鉴权必须区分：admin JWT vs wxapi JWT |
| 微信原生能力（scene 分享、code2session） | 官方链路，无第三方依赖 | 第三方登录 SDK（不必要） | 方案分享 path=preview?id=方案ID；真实 wx API 在 dev 必须 mock |

## 数据模型要点（V2.0 重定）
- 商品**无独立 SKU 表**：规格/睡感以字段内嵌 `gin_product`（aaa.md §5.2.2）
- 「方案 Scheme + 方案快照」取代 V1.1「选品单 wishlist」：`gin_scheme` + `gin_scheme_product(product_snapshot JSON)`，历史方案不随产品更新变化（aaa.md §4.3.1）
- 移除 V1.1 内容社区模块：gin_article 保留作资讯/品牌服务展示；gin_video/gin_content_goods/gin_spu/gin_sku/gin_tag 不再建

## 待补充
- 商品图片/视频云存储：阿里云 OSS / 腾讯云 COS（待账号/桶确认，先留适配层 + 本地 mock）
- 部署目标机器规格（云服务器 4C8G 为前提假设，aaa.md §2.3）