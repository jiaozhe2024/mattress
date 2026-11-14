<!--
 * @Author: jiaozhe undefined
 * @Date: 2026-11-14 12:50:04
 * @LastEditors: jiaozhe undefined
 * @LastEditTime: 2026-11-14 12:52:00
 * @FilePath: /mattress-ux/AGENTS.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
# 床垫选品方案小程序 (mattress-ux) — Agent 工作指南

## 这是什么项目
面向 **B 端导购/经销商** 的床垫销售赋能微信小程序：Uni-app (Vue3) 小程序 + FastAPI 后端。核心链路：产品数字化展示 → 客户定制方案快速生成（多方案管理）→ 方案微信一键分享裂变。**明确不做** C 端下单/支付/物流/会员（aaa.md §1.2）。商用项目，UI 由 Designer 在 Figma 出稿，CC 开发，Hermes 独立验收。品牌 **LEKASI 乐卡思**。

## 快速定向
- 工作目录：项目根 = /Users/jiaozhe/own/mattress-ux
- **权威规格**：仓库根 `aaa.md`（技术需求规格说明书 V2.0），docs/product-specs/PRD-v2.0.md 为开发依据提炼
- 技术栈（定稿见 docs/TECH_DECISIONS.md）：
  - 后端 API：FastAPI + SQLModel + MySQL8 + Redis + arq。参考 JiayuXu0/FastAPI-Template（已核验 MIT），仅复用其 Router → Service → Repository 分层、RBAC、JWT、arq 异步任务队列的设计与代码；ORM 层按定稿自建 SQLModel + MySQL8（模板官方为 Tortoise+PG，不采用）。产品/方案/内容业务由 CC 从零生成
  - 管理后台 (B端)：Vue3 + Element Plus + Vite，不套模板，由 CC 直接生成 CRUD 页面（基于后端 Schema，保证代码风格统一）
  - 小程序 (C端)：Uni-app + Vue3 + TS + Pinia，参考 小兔鲜儿 (uniapp-shop-vue3-ts) 的请求封装、SKU 选择器、商品卡片；"多清单选品/方案"核心逻辑由 CC 从零生成
- 核心业务模型（V2.0）：方案 Scheme（gin_scheme）+ 方案产品快照（gin_scheme_product，JSON 固化，产品更新不影响历史方案）；商品无独立 SKU 表，规格内嵌字段
- 目录：backend/（FastAPI 后端 + Admin）、miniprogram/（小程序端）、scripts/e2e/（自动化验收脚本）、docs/、jp/（设计参考图）
- 旧基座已清理：RuoYi-FastAPI（BE-01）代码已 git 移除、容器/卷已 down --volumes；backend/ 待按 NG-01 重建。BE-01 记为 cancelled，历史记录见 docs/exec-plans/active/BE-01-sprint-output.md（端口/前缀信息已失效）
- 启动：后端 backend/ `docker compose up -d`；小程序用微信开发者工具 CLI `cli open --project miniprogram`（cli = /Applications/wechatwebdevtools.app/Contents/MacOS/cli）
- 测试：后端 pytest（backend/ 内）；小程序 vitest + miniprogram-simulate；E2E `node scripts/e2e/<页>.auto.js`
- 环境检查：`bash init.sh`

## 知识库地图
| 我想了解... | 去读这个文件 |
|------------|-------------|
| 规格权威源（技术需求说明书 V2.0） | aaa.md（仓库根） |
| 产品需求（PRD V2.0） | docs/product-specs/PRD-v2.0.md |
| 业务定位、目标用户 | docs/business-solution.md |
| 整体架构、模块划分 | docs/ARCHITECTURE.md |
| 命名规则、代码风格 | docs/CONVENTIONS.md |
| 技术选型原因 | docs/TECH_DECISIONS.md |
| 什么叫"完成" | docs/QUALITY.md |
| **LEKASI V3 设计基线（UI 还原依据，逐页精确规格 + token 真值）** | **docs/design/design-pack-readme.md** → 先读其顶部「给 CC 的第一句话」 |
| Figma 设计交付约定（V2.0 旧版，仅流程约定仍有效） | docs/design/figma-handoff.md |
| 当前进行中的计划 | docs/exec-plans/active/ |
| 待开发功能列表 | docs/exec-plans/backlog.md |
| 已知技术债务 | docs/exec-plans/tech-debt-tracker.md |

## 核心约定（必读，违反即返工）
1. 用户分表：后台/运营用户与小程序用户严格分表；小程序用户进 wx_user（openid 唯一索引），永远不写进后台用户体系。
2. 业务表前缀 gin_，不依赖基座框架表结构（跟随上游升级不被绑架）。
3. 搜索用 MySQL FULLTEXT/LIKE，数据量 <10 万禁止引入 Elasticsearch。
4. 微信真实 API（wx.login/code2session、订阅消息）在 dev/自动化环境必须 mock（固定测试 openid），解析逻辑用单测覆盖。
5. 每个页面/功能交付时必须同时交付 scripts/e2e/<功能>.auto.js（miniprogram-automator 脚本），与页面同 commit。
6. CC 实现任何 UI 页面前，先读 **docs/design/design-pack-readme.md（LEKASI V3 设计基线）** → `design-spec/spec.md`（逐页精确规格）+ `design-spec/design-tokens.md`（token 真值）+ `references/*.png`（10 张视觉基线）+ `open-questions.md`（13+2 条疑问与决议）+ `acceptance/visual-checklist.md`（自检清单），以及任务中挂载的设计稿链接。**品牌视觉以 LEKASI 稿为准（yellow #F7C400 + navy #1A2260）。`aaa.md` §3.1.2 的品牌金 #D4A574、`design-brief.md` 的「宝顿」、`jp/` 目录全部图片均为 V2.0 旧记录，已作废，禁止引用。**
7. 商品交易（订单/支付/购物车）不在 V2.0 范围，不要实现、不要设计表。
8. 异步红线：严禁在 FastAPI 的 async 路由中调用同步库（requests、time.sleep、同步 Pillow）；所有外部调用必须用 httpx.AsyncClient，海报生成等耗时操作必须扔进 arq 异步队列，避免阻塞主线程。
9. 小程序状态管理：多清单选品逻辑必须用 Pinia（useSelectionStore：当前方案/清单 ID、已选商品列表、addToSelection/removeProduct），严禁用 uni.setStorageSync 或全局变量在页面间传递选品数据，否则参数对比/方案生成功能无法实现。
10. 方案快照：创建/更新方案时必须固化产品信息 JSON 到 gin_scheme_product.product_snapshot，历史方案不随产品更新变化（aaa.md §4.3.1）。
11. 商用 License 红线：引入任何开源代码前先查 LICENSE，必须是 MIT 或 Apache-2.0 才能直接复制文件；GPL 或不明协议只参考代码思路，绝不复制文件。（FastAPI-Template 已核验 MIT；引入 小兔鲜儿 前同样先查。）

## 工作规范
1. 改之前先读：修改任何模块前先读对应文档；FastAPI-Template 基座内部结构沿用其官方约定（Router → Service → Repository 分层），改基座代码须在 commit 说明原因。
2. 完成即提交：每功能完成后立即 git commit，格式 type(scope): 描述。
3. 更新文档：影响架构/约定的修改同步更新 docs/。
4. 不要猜：看不懂先读文档，文档没有再问（tasks.json 描述不清时问 Hermes，不要自行发明需求）。

## 任务管理（harness 流程）
- 任务唯一队列：tasks.json（本仓库根目录），Hermes 写入并分配，CC 执行
- 每任务有 verify 字段，requires_eval=true 的任务完成须写 docs/exec-plans/active/<id>-sprint-output.md 待 Hermes（Evaluator）复跑验收通过才置 done
- 跨 session 状态：git log 为主记录，progress.md 顶部追加每次关键进度，不删历史

## 禁止事项
- 不要修改 .git/、node_modules/
- 不要跳过 verify 自行宣称完成
- 不要直接改基座框架系统表结构（业务表一律 gin_ 前缀）
- 不要实现 PRD 范围外的大功能（先回写 backlog）