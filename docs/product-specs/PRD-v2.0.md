# 床垫选品方案小程序 PRD V2.0

- 版本：2.0（2026-11-05）
- 变更（相对 V1.1）：产品重新定位为**面向 B 端导购/经销商的销售赋能工具**；新增「方案（Scheme）+ 方案快照」核心模型，取代 V1.1 的「选品单 wishlist」；移除内容社区模块（文章/视频带货），资讯降级为品牌内容展示；商品模型简化为**无 SKU 规格表**（规格以字段形式内嵌）；新增 Admin 运营统计与操作日志要求
- 权威来源：仓库根 `aaa.md`（技术需求规格说明书 V2.0）。本文档为开发依据提炼，规格细节冲突时以 `aaa.md` 为准
- 状态：技术选型已定稿，UI 由 Designer 出稿（已有一批参考图在 `jp/`），CC 开发，Hermes 验收

## 1. 业务定位（重定）

面向 **B 端导购/经销商**的床垫销售赋能微信小程序，核心价值：
- 产品数字化展示（替代纸质手册）
- 客户定制方案快速生成（多清单/多方案管理）
- 方案一键分享（微信生态闭环）
- 品牌与服务体系传递

**明确不做**：C 端下单、支付、物流、会员等电商交易模块（与 V1.1 一致）。

## 2. 目标用户

| 角色 | 端 | 核心诉求 |
|------|----|---------|
| 门店导购 | 微信小程序 | 为单个客户快速生成床垫方案，微信分享给客户确认 |
| 经销商业务员 | 微信小程序 | 外出拜访展示产品库，现场制作方案 |
| 品牌运营人员 | Web 管理后台 | 维护产品、轮播图、资讯内容、品牌信息 |
| 内容管理员 | Web 管理后台 | 审核方案数据、查看运营统计 |

## 3. 核心模型（V2.0 新定义）

- **SPU**：一款床垫型号（如「卷绵1号护脊款」）
- **SKU**：V2.0 商品**不建独立 SKU 规格表**，规格（尺寸/睡感）以字段内嵌于商品；`sku` 仅作展示术语保留
- **方案（Scheme）**：导购为单个客户选配的产品集合（如「主卧床垫方案」含 3 款）
- **方案快照**：保存方案时固化产品信息 JSON 副本，产品后续更新不影响历史方案（aaa.md §4.3.1）
- **卷包床垫**：可压缩卷装品类

## 4. 前端（小程序，Uni-app + Vue3 + TS + Pinia）

> 页面路由、交互细节、字段、代码示例以 `aaa.md` §3 为准。以下为模块清单。

- **全局**：底部 3 Tab（首页 / 产品 / 我的）；全局悬浮「选款」按钮（右下角，`#D4A574` 品牌金，跳 `/pages/scheme/selection`）；微信静默登录 + JWT（存 `wx.setStorageSync('token')`，401 自动刷新）；分享卡片配置与分享计数
- **首页** `/pages/index/index`：轮播 Banner、7 大产品分类宫格入口、品牌服务横滚、宝顿资讯/联系客服入口
- **产品中心**：
  - 列表页 `/pages/product/list`：搜索（防抖 + 历史）、左侧分类侧边栏、排序/视图切换、产品卡片（+号加入选品）、底部已选栏（Pinia `useSelectionStore`）
  - 详情页 `/pages/product/detail`：轮播、基础信息、详情/实拍图 Tab、底部操作栏（分享/小程序码/选款）
- **方案中心**：
  - 编辑页 `/pages/scheme/edit`：标题、已选产品横滚、详细说明折叠、保存/预览分享
  - 列表页 `/pages/scheme/list`：我的方案卡片，长按删除
  - 预览页 `/pages/scheme/preview`：长图式只读展示，创建者可见返回编辑，访客只读（区分 `preview` vs `public` 接口）
- **个人中心** `/pages/user/index`：品牌介绍、招商加盟（拨号）、客服承诺、我的方案入口

## 5. 后端（FastAPI + SQLModel + MySQL8 + Redis，单一服务双路由）

### 5.1 wxapi（小程序端，`/wxapi/*`）
- 认证：`POST /wxapi/auth/login`（wx.login code → code2session，dev mock）→ 查/建 wx_user → 签发 wxapi JWT
- 内容：`GET /wxapi/home`（聚合 banners/categories/services）、`/wxapi/categories`、`/wxapi/products`（分页/分类/关键词/排序）、`/wxapi/products/{id}`、`/wxapi/articles`、`/wxapi/articles/{id}`、`/wxapi/brand`
- 方案：`/wxapi/schemes` CRUD（创建传 `title/product_ids[]/remark`，**生成方案快照**）、`/wxapi/schemes/{id}`、`/wxapi/schemes/{id}/public`（免登录）、`/wxapi/schemes/{id}/share`（分享计数）、`DELETE /wxapi/schemes/{id}`（软删除）

### 5.2 admin API（`/api/v1/*`）
- 内容：轮播图、产品分类、产品（含多图/富文本/上下架/批量）、资讯与服务、品牌信息配置
- 数据：用户管理（wx_user 列表/禁用）、方案数据管理（列表/详情/删除/统计预留）
- 系统：管理员账号、角色权限（菜单级+按钮级）、操作日志

## 6. 技术约束（已确认，写死）

- 小程序：Uni-app + Vue3 + TS + Pinia（多清单/选品状态必须 Pinia，禁止 uni.setStorageSync 跨页传选品数据）
- 后端：FastAPI + SQLModel + MySQL 8 + Redis + arq；参考 JiayuXu0/FastAPI-Template（MIT）的 Router→Service→Repository 分层 / RBAC / JWT / arq，**ORM 层自建 SQLModel + MySQL8（asyncmy）**，不采用模板官方 Tortoise+PG
- Admin 前端：Vue3 + Element Plus + Vite + TS，CC 基于后端 Swagger 直接生成，不套模板
- 用户分表：后台管理员用户与小程序用户严格分表，小程序用户进 `wx_user`（openid 唯一索引），永不混写后台用户体系
- 业务表前缀 `gin_`，与基座框架表隔离；业务代码不依赖基座表结构
- 方案快照：创建/更新方案时固化产品 JSON 到 `gin_scheme_product.product_snapshot`
- 搜索：MySQL LIKE / FULLTEXT（ngram）；数据量 <10 万禁止引入 Elasticsearch
- 异步红线：async 路由禁同步库（requests/time.sleep/同步 Pillow）；外部调用用 httpx.AsyncClient；海报生成等耗时任务入 arq 队列
- 微信真实 API（wx.login/code2session 等）在 dev/自动化环境必须 mock（固定测试 openid），解析逻辑用单测覆盖
- 文件存储：阿里云 OSS / 腾讯云 COS（图片/视频 CDN），账号未定时先留适配层 + 本地 mock
- 部署：Docker Compose（api + worker + mysql8 + redis + admin nginx）+ HTTPS + 域名 ICP 备案

## 7. 数据模型（V2.0，BE-02 落地时出完整 DDL + alembic）

| 业务表 | 说明 |
|--------|------|
| `gin_product_category` | 产品分类（name/icon/parent_id 预留/sort/status） |
| `gin_product` | 产品（category_id/name/model 唯一/slogan/spec/sleep_feel/main_image/detail_images/real_images/detail_content 富文本/sort/status） |
| `wx_user` | 小程序用户（openid 唯一/nickname/avatar/status/last_login_at） |
| `gin_scheme` | 方案（user_id/title/remark/product_count/share_count） |
| `gin_scheme_product` | 方案产品快照（scheme_id/product_id/product_snapshot JSON/sort，级联删除） |
| `gin_banner` | 轮播图（image/jump_type 1无2分类3产品4外链/jump_value/sort/status） |
| `gin_article` | 资讯与服务（title/category 服务或资讯/cover/content 富文本/status） |
| `gin_brand_info` | 品牌信息配置（单行 KV/JSON：介绍/加盟电话/客服承诺/门店图） |

> Admin 管理员/角色/权限/操作日志走基座（FastAPI-Template）RBAC 表，不占 gin_ 业务前缀。

## 8. 验收约定

- 每页面/功能交付 `scripts/e2e/<功能>.auto.js`（miniprogram-automator），与页面同 commit
- Hermes 三层验收：L1 diff 审查 → L2 pytest/vitest + automator E2E + 截图视觉对照 → L3 真机预览（发布前用户确认）
- Admin/后端：pytest + curl 断言，验收见各任务 verify 字段

## 9. Backlog（暂不排期）

- 方案运营统计图表（方案创建量趋势、热门产品 Top10、活跃导购 Top10）
- 资讯定时发布
- MySQL 主从 + 每日 OSS 备份自动化
- 海报生成为服务端合成（Pillow/arq）或小程序 Canvas 出图（V2.0 先出转发卡片）
- Elasticsearch 搜索（>10 万行再评估）
