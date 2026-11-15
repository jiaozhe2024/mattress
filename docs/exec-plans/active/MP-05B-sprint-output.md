# MP-05B Sprint Output — 方案编辑页（空态与填充态同构）

- 任务：MP-05B（tasks.json，priority=high，blocked_by=MP-07 + MP-05A，均已 done）
- 执行：CC 会话 `proc_d91fbad6ffab` —— **代码写完，但权限被拦**（`npx`/`npm`/`git` 全部
  返回 "requires approval"）。**CC 明确拒绝用 python 绕过权限、也拒绝伪造 verify 结果**，
  如实回报后停止。Hermes 接手完成验证、修测试、补 e2e、提交。
- 结论：代码级 verify 全 PASS；动态段环境阻塞（DevTools 服务端口未开）

## 1. 交付清单

| 文件 | 行数 | 内容 |
|---|---|---|
| `pages/scheme/edit.vue` | 564 | 同页空态/填充态：标题输入 + 产品缩略图 + 详情展开 + 底部三按钮 |
| `components/scheme/schemeEditModel.ts` | 113 | 文案/校验/载荷/Q3 按钮 variant 配置（纯逻辑） |
| `api/scheme.ts` | 78 | `createScheme` / `updateScheme`（走 utils/request 自动注入 token） |
| `tests/schemeEditModel.test.ts` | 119 | model 单测 |
| `tests/schemeEditPage.test.ts` | 344 | 页面/交互单测 |
| `scripts/e2e/scheme-edit.auto.js` | 335 | **Hermes 补写**（CC 未来得及）双段 + TCP 端口预检 |
| `pages.json` / `config.ts` | — | 注册页面（custom 导航）+ `SCHEME_LIST_PAGE`/`SCHEME_PREVIEW_PAGE` |

## 2. verify 逐项实测（Hermes 独立复跑）

| # | verify 项 | 结果 | 实测 |
|---|---|---|---|
| 1 | build 0 error | **PASS** | `DONE Build complete.`，`pages/scheme/edit.*` 产出 |
| 2 | 空态 112×126 添加卡 + `产品数量：0` | **PASS（静态）** | `width:112px` 命中；文案在 model |
| 3 | 填充态 105×126 缩略图 + `产品数量：N` | **PASS（静态）** | `width:105px` + 产品图 `height:90px` |
| 4 | 三按钮宽度 108/92/119 | **PASS** | 宽度定义在 model 的按钮配置里（Q3 一份配置驱动） |
| 5 | 空标题保存被拦截 | **PASS（单测）** | page 单测覆盖；动态段待端口 |
| 6 | 输入标题保存后跳方案列表 | **PASS（单测）** | 单测覆盖 POST/PUT + 跳转；列表页未建走 toast 兜底 |
| 7 | 预览分享跳预览页 | **PASS（单测）** | 先保存再跳，MP-05D 未建走 toast 兜底 |
| 8 | 截图与设计稿比对 | **未完成** | 动态段阻塞 |
| 9 | 无版本条 | **PASS** | 全仓无「参考复刻优化版」 |

补充实测：
- `npx vitest run` → **422 passed / 30 files**（MP-05A 基线 386，本轮 +36）
- `npm run type-check` → exit 0
- `npm run build:mp-weixin` → DONE 0 err
- e2e 静态段 → **26 PASS / 0 FAIL**
- token 合规：**hex=0 / 裸 px 间距=0 / 裸行高=0**

## 3. 规格逐项核对（spec.md §5.5 空态 + §5.7 填充态）

| 规格项 | spec | 实现 |
|---|---|---|
| 标题输入 | h48，border-b 1px line | ✓ |
| 空态占位 | `方案标题` Regular 14 text3 | ✓ |
| 填充态文字 | Regular 14 text1 | ✓ |
| pencil | 16×16 | `:size="16"` |
| pencil 热区（Q13） | ≥44×44 | `se-title-pencil` 44px |
| 空态添加卡 | 112×126 bg fill radius8 | ✓ |
| 填充缩略图 | 105×126 bg cream radius8 | ✓ |
| 缩略图产品图 | 105×90 object-cover | `height:90px` |
| 移除角标 | 20×20 bg navy `×` Inter 15 textInv | ✓ |
| plus | 26×26 | `:size="26"` |
| `产品数量：N` | Regular 12 text3 居中 | ✓ |
| 分隔线 | 1px line | ✓ |
| `详细说明` | Regular 12 text3 | ✓ |
| chevron-down | 24×24 | `:size="24"` |
| 底栏 | bg navy p14 gap8 | ✓ |
| `我的方案` | 108×42 radius20 bg textInv border navy50 Medium14 text2 | ✓ |
| `保存` / `预览分享` | 92×42 / 119×42 bg yellow Medium15 navy | ✓ |
| **Q3 variant** | 三按钮可配主次，本轮等权重 | model 用 primary/secondary 一份配置驱动 |

## 4. Hermes 接手修正

1. **修 2 条失败的测试断言**（是断言写法问题，不是功能缺陷）：
   - `stringContaining("width:108px")` 与实际 `"width: 108px;"`（冒号后有空格）不匹配
     → 改为先去空白再 `toContain`
   - `<input :focus>` 在小程序组件上不序列化为 DOM attribute
     → 改为断言组件响应式状态 `titleFocus`
2. **补写 e2e 脚本**（CC 未来得及）：沿用 MP-05A 的双段结构 + TCP 端口预检。

## 5. 遗留与风险

1. **动态段未验证**（DevTools 服务端口 9420 未开）：点击 `+`/`×`/`保存`/`预览分享`、
   截图比对均待解锁。
2. **MP-05C/MP-05D 未建**：保存后跳列表、预览跳转均走 navigateTo fail → toast 兜底，
   选品状态保留在 Pinia 不丢。建页后自动生效。
3. **键盘态/展开态**：Q8 DEFERRED，用最小可用实现（textarea 展开、focus 输入）。
4. **权限拦截问题**：本次 CC 因 `npx`/`npm`/`git` 被拦而无法自验。建议在
   `.claude/settings.local.json` 的 allow 列表加入通配符
   （`Bash(npx *)`、`Bash(npm *)`、`Bash(git *)`、`Bash(node *)`），否则后续每个
   CC 会话都会卡在同一处。**这是本次最重要的流程发现。**
