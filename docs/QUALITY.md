# 质量定义（Definition of Done）

## 完成定义（DoD）
1. 本地运行正常：后端 `docker compose up` 后接口 200；小程序 `cli open --project miniprogram` 编译 0 报错
2. 对应测试存在且通过：后端 pytest；小程序纯逻辑 vitest（+miniprogram-simulate）；每页面 scripts/e2e/<功能>.auto.js 存在
3. 校验/静态检查通过：PRD 技术约束逐条对照（分表、gin_ 前缀、不用 ES、wx API mock）
4. 提交清晰：type(scope): 描述 格式，单功能单 commit
5. 影响架构/约定时 docs/ 同步更新
6. requires_eval=true 的任务：sprint-output.md 经 Hermes 复跑验收后才置 done

## 代码审查清单
- 正确性：wxapi 路由是否鉴权；wx_user 是否与后台用户表混写；openid 是否唯一约束；分享 scene 是否有非法 ID 防护；分页是否顺手带上架状态过滤
- 安全：SQL 注入（禁止裸字符串拼接查询）；JWT 隔离（admin/wxapi 双签发体系互不越权）
- 可维护性：是否复用组件库/既有组件而非手写轮子；业务逻辑是否在 Service 层而非 Controller；是否有重复代码
- 小程序性能：瀑布流是否用虚拟滚动/分页加载；图片是否 lazy-load；首屏是否分块渲染

## 测试要求
- 后端：每个 wxapi 接口至少一条 pytest（含异常分支）；分享解析单测覆盖（存在/不存在/非法 scene）
- 小程序：纯函数（scene 解析、参数格式化）vitest 必测；页面交互 automator 断言
- E2E 断言不得依赖真实 wx API 返回值（一律 dev-mock）

## 验收流程（Hermes Evaluator）
L1 diff review（与 PRD/API 契约对表）→ L2 跑 pytest/vitest + automator 断言 + 截图视觉对照（Figma 稿/PRD）→ L3 发布前用户真机预览确认（cli preview 二维码，用户扫码）