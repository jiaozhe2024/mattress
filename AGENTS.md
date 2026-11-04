# 床垫选品小程序 (mattress-ux) — Agent 工作指南

## 这是什么项目
微信原生小程序 + FastAPI 后端的床垫在线选品工具：商品展示（材质/软硬度/厚度/适用人群）+ 内容社区（文章/视频带货）+ 选品单（收藏夹 + 微信分享裂变）。商用项目，UI 由 Designer 在 Figma 出稿，CC 开发，Hermes 独立验收。

## 快速定向
- 工作目录：项目根 = /Users/jiaozhe/own/mattress-ux
- 技术栈：小程序（微信原生 + Vant Weapp）+ FastAPI/SQLAlchemy/MySQL8/Redis（RuoYi-FastAPI 基座）+ Vue3/Element Plus Admin
- 目录：miniprogram/（小程序端）、backend/（FastAPI + Admin，基座 fork 自 insistence/RuoYi-FastAPI）、scripts/e2e/（自动化验收脚本）、docs/
- 启动：后端 backend/ `docker compose up -d`；小程序用微信开发者工具 CLI `cli open --project miniprogram`（cli = /Applications/wechatwebdevtools.app/Contents/MacOS/cli）
- 测试：后端 pytest（backend/ 内）；小程序 vitest + miniprogram-simulate；E2E `node scripts/e2e/<页>.auto.js`
- 环境检查：`bash init.sh`

## 知识库地图
| 我想了解... | 去读这个文件 |
|------------|-------------|
| 产品需求（PRD V1.1） | docs/product-specs/PRD-v1.1.md |
| 业务定位、目标用户 | docs/business-solution.md |
| 整体架构、模块划分 | docs/ARCHITECTURE.md |
| 命名规则、代码风格 | docs/CONVENTIONS.md |
| 技术选型原因 | docs/TECH_DECISIONS.md |
| 什么叫"完成" | docs/QUALITY.md |
| Figma 设计交付约定 | docs/design/figma-handoff.md |
| 当前进行中的计划 | docs/exec-plans/active/ |
| 待开发功能列表 | docs/exec-plans/backlog.md |
| 已知技术债务 | docs/exec-plans/tech-debt-tracker.md |

## 核心约定（必读，违反即返工）
1. 用户分表：sys_user 只放运营人员；小程序用户进 wx_user（openid 唯一索引）。永远不要把小程序用户写进 sys_user。
2. 业务表前缀 gin_，不依赖框架表结构（跟随上游升级不被绑架）。
3. 搜索用 MySQL FULLTEXT/LIKE，数据量 <10 万禁止引入 Elasticsearch。
4. 微信真实 API（wx.login/code2session、订阅消息）在 dev/自动化环境必须 mock（固定测试 openid），解析逻辑用单测覆盖。
5. 每个页面/功能交付时必须同时交付 scripts/e2e/<功能>.auto.js（miniprogram-automator 脚本），与页面同 commit。
6. CC 实现任何 UI 页面前，先读 docs/design/figma-handoff.md 和任务中挂载的 Figma 设计稿链接/token。
7. 商品交易（订单/支付/购物车）不在 V1.1 范围，不要实现、不要设计表。

## 工作规范
1. 改之前先读：修改任何模块前先读对应文档；RuoYi-FastAPI 基座内部结构沿用其官方约定，改框架代码须在 commit 说明原因。
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
- 不要直接改 RuoYi 框架系统表（sys_*）结构
- 不要实现 PRD 范围外的大功能（先回写 backlog）