# 项目进度记录

> 每次 session 完成任务后在顶部追加，不删历史。格式：## [日期] [任务名]

---

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