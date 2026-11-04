# 项目进度记录

> 每次 session 完成任务后在顶部追加，不删历史。格式：## [日期] [任务名]

---

## 2026-11-04 初始化 Harness（PRD V1.1 + 技术选型定稿）
- 完成 harness-step1/3：AGENTS.md、docs/ 知识库、init.sh、tasks.json、progress.md
- PRD 升级 V1.1：新增内容社区模块（图文/视频带货）；热词管理降级为 backlog
- 技术选型定稿：原生小程序+Vant Weapp / RuoYi-FastAPI 基座（详见 docs/TECH_DECISIONS.md）
- UI 流程：Designer 在 Figma 出稿（约定见 docs/design/figma-handoff.md），CC 按稿实现，Hermes 验收对照截图
- tasks.json 初始任务数：14（BE-01~07 后端线、MP-01~07 小程序线；MP-02~07 blocked 等 Figma 稿）
- 下次从这里开始：读 tasks.json，选 priority=high 且 status=pending 的任务（当前 BE-01 / MP-01），派 CC 执行，Hermes 当 Evaluator
- 待用户动作：① 微信开发者工具扫码登录一次（automator 验收前置） ② Designer Figma 稿交付 ③ 云服务器/域名预算确认