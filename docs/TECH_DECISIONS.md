# 技术选型决策

| 选型 | 原因 | 替代方案 | 注意事项 |
|------|------|---------|---------|
| 微信原生小程序 + Vant Weapp | 单平台商用最稳；无跨端框架编译链，CC 可直接产代码；Vant 组件覆盖瀑布流/卡片/弹窗 | uni-app/Taro（需确认第二端） | 无热更新，验收靠 automator + 截图 |
| RuoYi-FastAPI 基座（insistence，MIT） | 若依式后台（RBAC/代码生成/日志监控）开箱即用；FastAPI 与用户既有项目同栈；MIT 商用无风险；上游活跃（2026-10 仍在提交） | litemall/mall（Java 全家桶，功能过剩）；RuoYi-Vue3-NestJS（第三方半成品，仅 42★/1★，弃坑风险，不采用） | 业务表用 gin_ 前缀，跟随上游升级不被绑架 |
| MySQL 8（FULLTEXT ngram） | 初期数据量小，LIKE/FULLTEXT 足够；避免过早引入 ES 的运维成本 | Elasticsearch（>10 万行再评估） | ngram 中文分词需建表时配置 parser |
| Redis | 若依基座自带（token/缓存/定时任务），顺手复用 | 无 | 首版无强缓存需求，仅随基座保留 |
| 单 FastAPI 服务双路由（/wxapi + admin） | 一套部署、一套模型，运维成本最低；小程序 API 与运营 API 物理同仓 | 拆两个服务（流量增长后再拆） | 鉴权必须区分：admin JWT vs wxapi JWT |
| 微信原生能力（scene 分享、code2session） | 官方链路，无第三方依赖 | 第三方登录 SDK（不必要） | scene ≤32 字符；真实 wx API 在 dev 必须 mock |

## 待补充
- 商品图片/视频云存储厂商（默认腾讯云 COS，未最终确认）
- 部署目标机器规格（腾讯云轻量 2C4G 为前提假设）