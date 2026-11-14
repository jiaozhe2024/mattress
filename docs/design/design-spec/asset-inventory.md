# 资源清单（Asset Inventory）

> 所有图片资源的 Figma 临时下载 URL **7 天后过期**，必须在开发时下载到项目静态目录，不得将临时 URL 作为运行时图片源。

## 一、图标（SVG）

图标全部来自 Figma 文件的 vector 图层，通过 `mcp__figma__download_assets` 导出，或用 `get_design_context` 返回的 `svgAssets` URL 下载。

### 底部 Tab 图标（组件集，10 页复用）

| 图标名 | Figma 节点 ID | 尺寸 | 说明 | 推荐替代 |
|---|---|---|---|---|
| `icon/home` | `10:41` | 24×24 | 首页（Tab 选中/未选中同图，靠 opacity 区分） | lucide `home` |
| `icon/grid` | `10:44` | 24×24 | 产品（Tab） | lucide `layout-grid` |
| `icon/user` | `10:50` | 24×24 | 我的（Tab） | lucide `user` |
| `undo-2` | 各页独立实例 | 24×24 | 返回（产品页/详情页底部 Tab） | lucide `undo-2` |

### 功能图标

| 图标名 | 尺寸 | 出现位置 | 推荐替代 |
|---|---|---|---|
| `chevron-left` | 22×22 | 二级页顶部导航左侧返回 | lucide `chevron-left` |
| `chevron-right` | 16×16 / 20×20 | 分类入口、方案卡片 | lucide `chevron-right` |
| `chevron-down` | 24×24 | 方案编辑页「详细说明」展开 | lucide `chevron-down` |
| `icon/search` | 16×16 | 产品页、选品页搜索框 | lucide `search` |
| `list` | 22×22 | 产品页视图切换 | lucide `list` |
| `pencil` | 16×16 | 方案标题编辑 | lucide `pencil` |
| `plus` | 26×26 | 添加产品 | lucide `plus` |
| `icon/share` | 24×24 | 详情页分享 | lucide `share` |
| `qr-code` | 24×24 | 详情页小程序码 | lucide `qr-code` |
| `message-circle` | 21×21 / 30×30 | 首页「联系客服」、我的页客服标题 | lucide `message-circle` |
| `newspaper` | 21×21 | 首页「乐卡思资讯」 | lucide `newspaper` |
| `circle-dot` | 15×15 | 微信胶囊右侧 | 微信小程序原生胶囊，**建议直接用原生导航** |

### 微信框架图标（系统层，通常由小程序框架提供）

| 图标名 | 尺寸 | 说明 |
|---|---|---|
| `ios-signal` | 17×17 | 状态栏信号 |
| `ios-wifi-signal` | 17×17 | 状态栏 WiFi |
| `ios-battery-full` | 24×17 | 状态栏电池 |

> 这三个是 iOS 状态栏示意，实际微信小程序由系统渲染，**不需要实现**。

## 二、位图

| 资源名 | 出现位置 | 原始尺寸 | 说明 |
|---|---|---|---|
| 首页卧室场景 | 首页品牌主视觉 | 343×190 | 需真实卧室场景图（深色调，与 navy 卡底协调） |
| 首页服务图 ×3 | 首页好眠服务卡 | ≈105×80 | 产品认识 / 睡眠小课堂 / 到店体验 各一张 |
| 分类列表系列横幅图 | 产品分类列表 | 343×120 | 9M 特制床垫产品图 |
| 产品主图 | 产品页全部 8 张卡 | 167×150 | ⚠️ **当前仅 2 张图交替复用，需补 8 张真实产品图** |
| 产品详情主图 | 详情页海报区 | 375×190 | 卷绵薄垫万能款 |
| 产品详情细节图 | 详情页产品详情区 | 343×180 | 面料/结构细节 |
| 选品页产品图 | 选品页 8 张卡 | 126.92×114 | ⚠️ 仅 3 张图复用，需补 8 张 |
| 选品已选缩略图 | 选品页已选栏 | 49×38 | 复用产品图 |
| 方案封面图 | 方案列表 2 张卡 | 88×96 | ⚠️ 2 张卡复用同一张，需区分 |
| 方案已选缩略图 | 方案编辑页 | 105×90 | 卷绵1号/2号 |
| 分享卡产品图 | 预览分享 2 张卡 | 327×190 | ⚠️ 2 张卡复用同一张，需区分 |
| 家居展示空间图 | 我的页品牌卡 | 335×315 | 实景家居空间照 |

### 待补资源汇总（TODO）

- [ ] **产品主图 8 张**（产品页）— 当前只有 2 张交替
- [ ] **选品页产品图 8 张** — 当前只有 3 张复用
- [ ] **方案封面图 2 张** — 当前 2 张卡共用一张
- [ ] **分享卡产品图 2 张** — 当前 2 张卡共用一张
- [ ] 首页服务图 ×3 的真实素材
- [ ] 家居展示空间实景图
- [ ] 所有产品图的统一裁切规范（当前 `object-cover`，无固定宽高比约定）

## 三、资源导出方式

### 方式 1：批量导出（推荐）

```bash
# 对每个 Frame 调用，拿到 export / rawImages / svgAssets 三类
# 参数：fileKey + nodeId
mcp__figma__download_assets(fileKey="hTG5vF6qoIYrY6gJM6N4F9", nodeId="86:1233")
```

### 方式 2：从 design_context 取 URL 再 curl

`get_design_context` 返回的截图 URL 与图片 URL 均为短时有效，需立即下载：

```bash
curl -fSL -o <本地路径> "<临时URL>"
```

### 方式 3：Figma 手动导出

选中图层 → 右侧面板 Export → 选格式与倍率（位图建议 @2x / @3x，图标导出 SVG）。

## 四、图标实现建议

1. **优先用图标库**（lucide / heroicons）替代 Figma 导出的 SVG —— 上述图标全部是通用线性图标，图标库版本更易维护。
2. **微信胶囊不要自己实现** —— 微信小程序的右上角胶囊由框架自动渲染，画板里的 `••• / circle-dot` 是示意，实际不需要写。
3. **状态栏不要自己实现** —— `ios-signal` / `ios-wifi-signal` / `ios-battery-full` 是系统渲染。
4. 若必须用 Figma 导出的 SVG，注意 `get_design_context` 给出的 SVG 是分层 `<img>` 嵌套，需要拍平为单文件 SVG。
