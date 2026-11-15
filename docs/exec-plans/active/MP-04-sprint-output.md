# MP-04 产品详情页 · Sprint Output

> 状态：**代码 + 单测 + e2e 脚本已交付；type-check 0 error、vitest 317/317 全绿、build:mp-weixin 0 error 已实测通过。**
> e2e 静态段 34/34 PASS；动态段因微信开发者工具服务端口未开启按环境阻塞（exit 2）上报，未伪造结果。

## 任务范围（tasks.json MP-04）
新建 `miniprogram/src/pages/product/detail.vue`，依据 `references/product-detail.png` + `spec.md §5.4`，
数据接 `GET /wxapi/products/{id}`；Q13 热区先行；Q12 不做版本条；Q8 缺失态不做插图。

## 交付文件

| 文件 | 说明 |
|---|---|
| `miniprogram/src/pages/product/detail.vue` | 产品详情页（新增，V3 还原） |
| `miniprogram/src/components/product/productDetailModel.ts` | 详情页纯函数/文案/数据收敛（新增） |
| `miniprogram/src/api/product.ts` | 新增 `getProductDetail(id)`（改动） |
| `miniprogram/src/pages.json` | 注册 `pages/product/detail`（custom 导航，未动 tabBar） |
| `miniprogram/vitest.config.ts` | 自定义元素补 `rich-text`（消除 Vue 解析告警） |
| `miniprogram/tests/productDetailModel.test.ts` | model 单测 15 项（新增） |
| `miniprogram/tests/productDetailPage.test.ts` | 页面挂载/交互/错误态单测 22 项（新增） |
| `scripts/e2e/product-detail.auto.js` | 双重分段 e2e（静态 34 项 + automator 动态，新增） |
| `docs/exec-plans/active/MP-04-sprint-output.md` | 本文件 |

## 逐区块规格核对（spec.md §5.4）

| 区块 | 规格要求 | 实现 | 静态断言 |
|---|---|---|---|
| 导航 | WechatNav 二级页，标题 `LEKASI 乐卡思` | `<WechatNav :title="DETAIL_NAV_TITLE" back />` | PASS |
| ①海报 | bg cream 圆角 8 | `.pd-poster` `$color-cream` + `$radius-8` | PASS |
| ①标题块 | p16 gap6；品牌 Inter Bold 10 字距1；产品名 Bold 23；副标 Regular 11 lh1.45 | `.pd-brand`/`.pd-poster-name`/`.pd-poster-slogan` | PASS |
| ①产品图 | h190 object-cover | swiper `.pd-poster-swiper`/`.pd-poster-image` height 190 | PASS |
| ①信息条 | bg yellowBg px16 py12 gap6；feature Medium 11；规格 Regular 10 | `.pd-info-bar`/`.pd-info-feature`/`.pd-info-spec` | PASS |
| ②分页点 | h20 居中 gap5；当前 6×6 navy，其余 6×6 line；1 张隐藏 | `.pd-dots`/`.pd-dot`/`.pd-dot--active`；`showDots` 控制 | PASS |
| ③基本信息 | p16 gap6；产品名 Bold 19；型号 Regular 13 text3 | `.pd-name`/`.pd-model` | PASS |
| ③操作组 | pt12 gap20 右对齐；分享/小程序码 icon24+字11 gap4；选款 52×52 圆角26 yellow shadow-fab + 下方文字 | `.pd-actions`/`.pd-action`/`.pd-select-circle` | PASS |
| ④分隔 | h10 bg fill | `.pd-divider` height10 `$color-fill` | PASS |
| ⑤详情 | p16 gap20；Tab 34 高圆角6（选中 navy/白字，未选 fill/text2）；细节图 h180；说明 gap10 lh1.45（小标题 Bold18 navy/正文 Regular13 text2/免责 Regular12 text3） | `.pd-detail`/`.pd-tab`/`.pd-tab--active`/`.pd-detail-image`/`.pd-desc*` | PASS |
| 富文本 | `<rich-text>` 渲染 detail_content | `.pd-rich` :nodes="detailContent" | PASS |
| ⑦交互 | Tab 切换 / onShareAppMessage / 小程序码弹层 / 圆形选款→store+toast | `onTabTap`/`onShareAppMessage`/`qrOpen`/`onSelect` | PASS |
| Q13 热区 | 分享/小程序码 ≥44×44（透明 padding，视觉不变） | `.pd-action-hit` min 44×44 | PASS |
| ⑧底部 | TabBar two | `<TabBar variant="two" />` | PASS |
| ⑨版本条 | 不实现（Q12）/无转场动画 | 无 `version-bar`、无 animation/transition | PASS |

## 实测验证结果

| 项 | 命令 | 结果 |
|---|---|---|
| type-check | `npm run type-check`（vue-tsc） | **EXIT 0，0 error** |
| 单测 | `npx vitest run` | **25 files / 317 tests 全绿**（基线 280 + 新增 37） |
| 构建 | `npm run build:mp-weixin` | **EXIT 0，Build complete**（dist/build/mp-weixin 产出 detail.*） |
| e2e 静态段 | `node scripts/e2e/product-detail.auto.js` | **PASS=34 FAIL=0**（token 合规：hex=0 / 裸 px 间距=0 / 裸行高=0） |
| e2e 动态段 | 同上 | **环境阻塞 exit 2**：`Failed to launch wechat web devTools, please make sure http port is open`（DevTools 未登录/服务端口未开；且 dist/dev 为旧产物未含 detail，需 `npm run dev:mp-weixin` 重建后再跑） |

> 修正记录：初次 type-check 暴露 `.map(absoluteUrl)` 把数组 index 当 `base` 传参的 TS2345（2 处），
> 已改为 `.map((src) => absoluteUrl(src))`；复跑 type-check 0 error。

## 遗留风险
1. 海报外距：spec 仅给内 `p16`，外距按基线图取 0（贴内容区）；如需左右 16 外边距需设计确认。
2. 小程序码弹层无设计稿（Q8 DEFERRED），为最小可用实现（图标占位 + 提示），非最终视觉/真实小程序码。
3. 富文本内相对图片地址：seed 的 `detail_content` 含 `<img src="/uploads/...">`，`<rich-text>` 不做 base 补全，
   真机可能不显示该图（产品图/实拍图已走 `absoluteUrl`，不受影响）；需后端富文本出绝对地址或前端预处理器。
4. e2e 动态段 `page.data("selectionStore.selectedCount")` 依赖页面数据可读；不可读时退化为跳过计数（单测已覆盖 store+toast 逻辑），需 DevTools 实跑确认。
5. 动态段需先 `npm run dev:mp-weixin` 重新生成 `dist/dev/mp-weixin`（当前 dev 产物为 MP-03B 旧构建，缺 detail 页）。

## 复跑命令
```
cd miniprogram && npm run type-check && npx vitest run && npm run build:mp-weixin
npm run dev:mp-weixin   # 另开终端，产出含 detail 的 dev 产物
node scripts/e2e/product-detail.auto.js
```
