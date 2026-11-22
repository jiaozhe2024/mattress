<!--
 * @Author: jiaozhe undefined
 * @Date: 2026-11-05 12:36:33
 * @LastEditors: jiaozhe undefined
 * @LastEditTime: 2026-11-19 10:31:37
 * @FilePath: /mattress-ux/docs/QUALITY.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->

质量定义（Definition of Done）V2
原则：每条要求都必须可判定、可复现、可证伪。存在性要求（“文件存在”“测试通过”）一律升级为有效性要求（“断言能失败”“覆盖率达标”“变异验证通过”）。

一、完成定义（DoD）

1. 本地运行
   □ 后端 docker compose up 后，核心接口全部返回 200，且日志无 ERROR 级异常
   □ 小程序 cli open --project miniprogram 编译 0 error / 0 warning（warning 需在 PR 中说明原因）
2. 测试存在且有效
   □ 后端 pytest 通过率 100%（跳过用例需在 PR 说明理由并关联 issue）
   □ 小程序纯逻辑 vitest 通过；页面交互 miniprogram-simulate / automator 断言通过
   □ 每个核心页面存在 scripts/e2e/<功能>.auto.js，且每条 e2e 至少含 1 条可失败的业务断言（纯 waitFor / 纯截图不计）
   □ 核心链路测试做过有效性验证：至少一次“故意改坏代码，确认对应测试变红”（变异验证或手工回退验证，记录在 PR 描述）
   □ 覆盖率门槛：后端核心 Service 分支覆盖率 ≥ 70%，wxapi 接口异常分支覆盖 100%（见第三节异常清单）
3. 校验 / 静态检查
   □ PRD V2.0 技术约束逐条对照通过：分表、gin\_ 前缀、方案快照、不用 ES、wx API mock
   □ lint / typecheck 通过（后端 ruff/mypy，小程序 eslint/tsc）
4. 提交规范
   □ 提交信息格式 type(scope): 描述
   □ 单功能单 commit；测试文件必须与该功能同批 commit（禁止先合代码后补测试）
5. 文档同步
   □ 影响架构 / 接口约定 / 部署方式时，同步更新 docs/，并在 PR 中链接对应文档 diff
6. 验收（Hermes Evaluator）
   □ requires_eval=true 的任务：sprint-output.md 经 Hermes 复跑验收通过后置 done
   □ 降级路径：Hermes 不可用时，由指定负责人手动执行同等 L1–L3 检查并留痕，不得无限期挂起
   二、代码审查清单
   正确性
   □ wxapi 路由是否鉴权
   □ wx_user 是否与后台用户表混写
   □ openid 是否有唯一约束
   □ 分享 scene / ID 是否做非法 ID 防护
   □ 方案越权校验：user_id == 当前用户
   □ 分页是否带上架状态过滤
   业务规则
   □ 方案创建 / 更新是否生成产品快照 gin_scheme_product.product_snapshot
   □ 分享计数是否仅在分享成功后 +1
   □ 已下架产品在列表 / 详情是否不可见
   安全
   □ 禁止裸字符串拼接 SQL（参数化查询 / ORM）
   □ JWT 隔离：admin / wxapi 双签发体系互不越权
   可维护性
   □ 复用组件库 / 既有组件，而非手写轮子
   □ 业务逻辑在 Service 层，Controller 只做编排
   □ 无重复代码（重复逻辑已抽取）
   小程序性能
   □ 图片 lazy-load
   □ 首屏分块渲染
   □ 列表分页加载
   异步红线
   □ async 路由中不得出现同步阻塞调用（requests / time.sleep / 同步 Pillow）；外部 HTTP 调用使用 httpx.AsyncClient；仅在确有耗时后台任务需求时引入队列
   三、测试要求
   后端（pytest）
   □ 每个 wxapi 接口至少一条正常路径 + 异常分支测试
   □ 必须覆盖的异常类型清单（逐项打勾）：
   □ 401 未登录 / token 失效
   □ 403 越权（访问他人资源）
   □ 404 资源不存在
   □ 422 参数校验失败
   □ 下游超时 / 异常（DB、第三方）
   □ DB 唯一约束冲突（如 openid 重复）
   □ 方案快照单测：存在 / 不存在 / 非法 ID 三分支
   □ 分享解析单测：存在 / 不存在 / 非法 ID 三分支
   小程序
   □ 纯函数（scene 解析、参数格式化）vitest 必测，含边界值
   □ 页面交互 automator 断言（非仅渲染，需含状态变化）
   E2E
   □ 断言不得依赖真实 wx API 返回值，一律 dev-mock
   □ flaky 处理：失败重跑 2 次仍失败才算失败；连续 flaky 的用例必须修复或显式 quarantine（不得静默 skip）
   Mock 边界（由人定义，AI 不得自行放宽）
   □ 禁止 mock：数据库、鉴权服务、核心业务 Service
   □ 允许 mock：第三方支付、短信、真实 wx API（dev-mock）
   □ 新增 mock 需在 PR 中说明理由
   混沌 / 韧性（维护阶段启用，架构阶段预留）
   □ 架构阶段已标记：所有单点故障、关键外部依赖、降级 / 熔断方案
   □ 维护阶段前置：metrics、日志、告警、SLO 就绪，稳态基线可量化
   □ 首次实验从 staging 单实例单故障开始，预设自动中止条件（如错误率 > 5%）
   □ 频率：月度基础场景（依赖超时、实例宕机）+ 季度复杂场景（网络分区叠加缓存失效），每次实验产出复盘并闭环
   四、验收流程（Hermes Evaluator）
   层级 内容 通过标准
   L1 diff review 与 PRD V2.0 / API 契约逐条对表，无遗漏
   L2 自动化验证 pytest / vitest / automator 全绿；截图视觉对照设计稿与参考图
   L3 真机确认 cli preview 二维码，用户扫码确认核心链路
