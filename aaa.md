# 床垫选品方案小程序 - 技术需求规格说明书 V2.0
## 1. 文档概述

### 1.1 文档目的
本文档明确「床垫选品方案小程序」的**产品功能、技术架构、API接口规范、数据模型与部署方案**，作为：
- 前后端开发、测试、产品验收的统一依据
- Claude Code AI 辅助开发的上下文规范
- 运维部署与后期迭代的参考手册

### 1.2 产品定位
面向B端导购/经销商的**床垫销售赋能工具类微信小程序**，核心价值：
- ✅ 产品数字化展示（替代纸质手册）
- ✅ 客户定制方案快速生成（多清单管理）
- ✅ 方案一键分享（微信生态闭环）
- ✅ 品牌与服务体系传递

**明确不做**：C端下单、支付、物流、会员体系等电商交易模块。

### 1.3 目标用户
| 用户角色 | 使用场景 | 核心诉求 |
|---------|---------|---------|
| **门店导购** | 微信小程序 | 快速为客户生成床垫选品方案，微信分享给客户确认 |
| **经销商业务员** | 微信小程序 | 外出拜访时展示产品库，现场制作方案 |
| **品牌运营人员** | Web管理后台 | 维护产品信息、轮播图、资讯内容 |
| **内容管理员** | Web管理后台 | 审核方案数据、查看运营统计 |

### 1.4 技术选型（核心决策）

#### 前端技术栈
| 模块 | 技术选型 | 选型理由 |
|------|---------|---------|
| **小程序端** | **Uni-app + Vue3 + TypeScript + Pinia** | 一套代码编译到微信小程序，Vue3+TS 生态与 AI 生成代码契合度高，Pinia 全局状态支撑"多清单选品/参数对比"核心逻辑（参考 小兔鲜儿 uniapp-shop-vue3-ts 的请求封装与商品卡片） |
| **管理后台** | **Vue3 + Element Plus + Vite + TypeScript** | 不套模板，由 Claude Code 基于后端 Swagger Schema 直接生成 CRUD 页面，保证代码风格统一 |

#### 后端技术栈
| 模块 | 技术选型 | 选型理由 |
|------|---------|---------|
| **API框架** | **FastAPI + Python 3.11+** | 异步高性能，Pydantic 天然适合接口契约，AI 生成代码友好 |
| **ORM** | **SQLModel (SQLAlchemy 2.0 + Pydantic)** | FastAPI 官方推荐，一个类搞定 DB 映射 + 数据校验 |
| **数据库** | **MySQL 8.0** | 商用标准，InnoDB 事务 + FULLTEXT（ngram）支撑中文搜索，数据量 <10 万无需 ES |
| **缓存** | **Redis 7.x** | 会话管理、热点数据缓存、异步任务队列 |
| **任务队列** | **arq (Async Redis Queue)** | 海报生成等异步任务，不阻塞主请求 |
| **文件存储** | **阿里云 OSS / 腾讯云 COS** | 图片/视频 CDN 加速，防盗链 |

#### 部署架构
- **容器化**：Docker + Docker Compose
- **反向代理**：Nginx（动静分离、SSL 终止）
- **CI/CD**：GitHub Actions / Gitee Actions（自动构建部署）

### 1.5 术语定义
| 术语 | 定义 | 示例 |
|------|------|------|
| **SPU** | 标准产品单元，即一款床垫型号 | 卷绵1号护脊款 |
| **SKU** | 库存量单位，SPU 下的具体规格 | 卷绵1号 - 1.8m×2m - 适中偏硬 |
| **方案** | 导购为单个客户选配的产品集合 | "主卧床垫方案" 含 3 款床垫 |
| **方案快照** | 方案保存时固化的产品信息副本 | 后续产品更新不影响历史方案 |
| **卷包床垫** | 可压缩卷装的床垫品类 | 核心产品线之一 |

---

## 2. 整体系统架构

### 2.1 系统分层架构
```
┌─────────────────────────────────────────────────────────┐
│                     展示层 (Presentation)                │
──────────────────────┬──────────────────────────────────┤
│  微信小程序 (导购端)  │      Web 管理后台 (运营端)        │
│  Uni-app+Vue3+TS+Pinia│   Vue3 + Element Plus + TS       │
└──────────────────────┴──────────────────────────────────┘
                            ↓ HTTPS (RESTful API)
┌─────────────────────────────────────────────────────────┐
│                     服务层 (Application)                 │
├──────────────────────┬──────────────────────────────────┤
│   FastAPI 应用服务    │        arq 异步任务队列           │
│   (API + Business)   │      (海报生成、数据统计)         │
└──────────────────────┴──────────────────────────────────┘
                            ↓ Async SQLAlchemy
┌─────────────────────────────────────────────────────────┐
│                      数据层 (Data)                       │
──────────────┬───────────────┬──────────────────────────┤
│  MySQL 8.0   │   Redis 7.x   │    阿里云 OSS / COS       │
│  (业务数据)   │  (缓存+队列)  │      (文件存储)           │
└──────────────┴───────────────┴──────────────────────────┘
```

### 2.2 核心业务流程图

#### 2.2.1 方案创建与分享流程
```mermaid
sequenceDiagram
    participant U as 导购用户
    participant MP as 小程序前端
    participant API as FastAPI后端
    participant DB as MySQL数据库
    participant OSS as 对象存储
    
    U->>MP: 点击"选款"悬浮按钮
    MP->>API: GET /api/v1/products (获取产品列表)
    API->>DB: 查询已上架产品
    DB-->>API: 返回产品数据
    API-->>MP: 返回产品列表
    
    U->>MP: 勾选产品，点击"OK"
    MP->>API: POST /api/v1/schemes<br/>(title, product_ids[])
    API->>DB: 创建方案主记录
    loop 每个产品ID
        API->>DB: 查询产品详情
        DB-->>API: 返回产品数据
        API->>API: 生成产品快照JSON
        API->>DB: 插入方案产品快照
    end
    DB-->>API: 返回方案ID
    API-->>MP: 返回创建成功
    
    U->>MP: 点击"预览分享"
    MP->>API: GET /api/v1/schemes/{id}/preview
    API->>OSS: 生成方案长图海报（异步）
    OSS-->>API: 返回海报URL
    API-->>MP: 返回预览数据
    
    U->>MP: 点击"分享给好友"
    MP->>WX: 调用微信分享API
    Note over WX: 生成带scheme_id的小程序卡片
    
    participant F as 好友（客户）
    F->>MP: 点击分享卡片
    MP->>API: GET /api/v1/schemes/{id}/public
    API->>DB: 查询方案及快照（无需登录）
    DB-->>API: 返回方案数据
    API-->>MP: 返回公开预览数据
    MP-->>F: 展示方案详情（只读）
```

### 2.3 部署架构（生产环境）
```
┌─────────────────────────────────────────────────────┐
│                   云服务器 (4C8G)                     │
├─────────────────────────────────────────────────────┤
│  Nginx (80/443)                                      │
│  ├─ admin.yourdomain.com → Vue3 静态文件             │
│  └─ api.yourdomain.com → FastAPI (Gunicorn+Uvicorn) │
│                                                       │
│  Docker Containers:                                  │
│  ├─ api:8000 (FastAPI应用，4 workers)                │
│  ├─ worker: (arq 异步任务处理器)                     │
│  ├─ mysql:3306 (MySQL 8.0，数据持久化)               │
│  └─ redis:6379 (Redis 7，缓存+队列)                  │
│                                                       │
│  定时任务:                                           │
│  └─ mysqldump 每日凌晨备份 → OSS                     │
─────────────────────────────────────────────────────┘
```

---

## 3. 前端（微信小程序端）功能需求

### 3.1 全局规范

#### 3.1.1 底部导航栏
- **固定3个Tab**：首页（`/pages/index/index`）、产品（`/pages/product/list`）、我的（`/pages/user/index`）
- **交互要求**：切换无刷新，保持各Tab页面状态（使用 `keep-alive` 思想）

#### 3.1.2 全局悬浮按钮
- **位置**：首页、产品列表页、产品详情页常驻右下角
- **样式**：圆形按钮，直径 56rpx，背景色 `#D4A574`（品牌金），文字"选款"
- **交互**：点击跳转 `/pages/scheme/selection`（产品选品页）
- **状态管理**：使用 Pinia 全局存储当前已选产品数量，实时显示角标

#### 3.1.3 登录与鉴权
- **首次进入**：自动微信静默登录（`wx.login` 获取 code → 后端换取 openid）
- **Token 管理**：
  - 后端返回 JWT Token，小程序存储于 `wx.setStorageSync('token', token)`
  - 所有业务请求 Header 携带 `Authorization: Bearer {token}`
  - Token 过期自动刷新（401 响应时触发）
- **数据隔离**：方案数据与用户 openid 强关联，后端校验防止越权

#### 3.1.4 分享规范
- **分享卡片配置**（`onShareAppMessage`）：
  ```javascript
  {
    title: `${scheme.title} - 床垫选品方案`,
    path: `/pages/scheme/preview?id=${scheme.id}`,
    imageUrl: scheme.cover_image || defaultImage
  }
  ```
- **分享统计**：分享成功后调用 `POST /api/v1/schemes/{id}/share` 记录次数

### 3.2 首页模块 (`/pages/index/index`)

#### 3.2.1 页面结构
```
┌─────────────────────────┐
│   顶部轮播 Banner       │
├─────────────────────────┤
│   产品分类入口 (7个)     │
│   [宫格布局 2列×4行]     │
├─────────────────────────┤
│   品牌服务板块          │
│   [横向滚动卡片]         │
├─────────────────────────┤
│   辅助功能入口          │
│   [宝顿资讯 | 联系客服]  │
└─────────────────────────┘
```

#### 3.2.2 功能点详述

**1. 轮播 Banner**
- **组件**：`<swiper>` 原生组件，`autoplay="{{true}}"`，`interval="5000"`
- **数据源**：`GET /api/v1/banners?status=1`
- **点击事件**：
  - `jump_type=1`（无跳转）：无操作
  - `jump_type=2`（产品分类）：`wx.navigateTo({ url: '/pages/product/list?category_id=' + jump_value })`
  - `jump_type=3`（指定产品）：`wx.navigateTo({ url: '/pages/product/detail?id=' + jump_value })`
  - `jump_type=4`（外链）：`wx.navigateTo({ url: '/pages/webview/index?url=' + encodeURIComponent(jump_value) })`

**2. 产品分类入口**
- **布局**：`<view class="category-grid">` + `wx:for` 渲染
- **数据源**：`GET /api/v1/categories?status=1&sort=asc`
- **分类清单**（硬编码+后台可配置）：
  | 分类名称 | 图标 | 跳转路径 |
  |---------|------|---------|
  | 9M特制床垫 | icon-9m | `/pages/product/list?category_id=1` |
  | 花筑手作 | icon-flower | `/pages/product/list?category_id=2` |
  | 卷绵时代 | icon-roll | `/pages/product/list?category_id=3` |
  | 小斑马 | icon-zebra | `/pages/product/list?category_id=4` |
  | 特制软床 | icon-bed | `/pages/product/list?category_id=5` |
  | 抗菌软床 | icon-antibacterial | `/pages/product/list?category_id=6` |
  | 助眠枕头 | icon-pillow | `/pages/product/list?category_id=7` |

**3. 品牌服务板块**
- **组件**：`<scroll-view scroll-x>` 横向滚动
- **数据源**：`GET /api/v1/services`
- **固定项**：服务九部曲、学习成长之旅、体验之旅
- **点击**：跳转资讯详情页 `/pages/article/detail?id={service_id}`

**4. 辅助入口**
- **宝顿资讯**：`wx.navigateTo({ url: '/pages/article/list' })`
- **联系客服**：`wx.openCustomerServiceChat({ corpId: 'xxx', kfUrl: 'xxx' })`

### 3.3 产品中心模块

#### 3.3.1 产品列表页 (`/pages/product/list`)

**页面结构**
```
┌─────────────────────────────────┐
│  搜索栏 [输入型号搜索]  🔍      │
├─────────┬───────────────────────┤
│ 分类    │  排序：综合 ▼  视图：□□│
│ 导航    ├───────────────────────┤
│ (左侧)  │  产品卡片  产品卡片    │
│         │  产品卡片  产品卡片    │
│         │  (右侧宫格列表)        │
├─────────┴───────────────────────┤
│  已选: 2  [缩略图] [缩略图] OK  │
└─────────────────────────────────┘
```

**功能点详述**

**1. 搜索功能**
- **组件**：`<van-search>` (Vant Weapp)
- **交互**：
  - 输入防抖 300ms
  - 实时调用 `GET /api/v1/products?keyword={keyword}`
  - 无结果显示空状态组件 `<van-empty description="暂无相关产品" />`
- **搜索历史**：本地存储 `wx.getStorageSync('search_history')`，最多保留 10 条

**2. 左侧分类导航**
- **组件**：`<van-sidebar>` + `<van-sidebar-item>`
- **数据源**：同首页分类接口
- **交互**：点击切换 `current_category_id`，触发右侧列表刷新

**3. 排序/视图切换**
- **排序选项**：综合（默认）、推荐、新品（`create_time desc`）
- **视图模式**：宫格（2列）、列表（1列），切换图标
- **实现**：点击排序 Tab 调用 `GET /api/v1/products?sort={sort_type}`

**4. 产品卡片**
- **组件**：自定义 `<product-card>` 组件
- **展示字段**：
  ```typescript
  interface ProductCard {
    id: number;
    name: string;          // 产品名称
    model: string;         // 型号
    main_image: string;    // 主图
    spec: string;          // 规格 (如 180×200×26cm)
    sleep_feel: string;    // 睡感标签 (如 适中偏硬)
    tags: string[];        // 核心卖点标签 (如 ['抗菌', '防螨', '护脊'])
    price?: number;        // 价格（可选，后台配置是否显示）
  }
  ```
- **操作按钮**：
  - 右下角圆形 "+" 按钮（直径 48rpx）
  - 点击调用 `addToSelection(productId)`
  - 已选产品显示 "已选" 状态（禁用按钮，灰色）

**5. 底部已选栏**
- **状态管理**：Pinia Store `useSelectionStore`
  ```typescript
  // stores/selection.ts
  export const useSelectionStore = defineStore('selection', {
    state: () => ({
      selectedProducts: [] as Product[],
      currentSchemeId: null as number | null,
    }),
    actions: {
      addProduct(product: Product) {
        if (!this.selectedProducts.find(p => p.id === product.id)) {
          this.selectedProducts.push(product);
        }
      },
      removeProduct(productId: number) {
        this.selectedProducts = this.selectedProducts.filter(p => p.id !== productId);
      },
      clearSelection() {
        this.selectedProducts = [];
      }
    },
    getters: {
      selectedCount: (state) => state.selectedProducts.length,
    }
  });
  ```
- **交互**：
  - 点击 "OK" 按钮：`wx.navigateTo({ url: '/pages/scheme/edit?products=' + JSON.stringify(selectedProducts) })`
  - 点击缩略图 "×"：调用 `removeProduct(productId)`

#### 3.3.2 产品详情页 (`/pages/product/detail`)

**页面结构**
```
┌─────────────────────────────────┐
│  产品轮播图 (主视觉+卖点图)      │
├─────────────────────────────────
│  产品名称 + Slogan              │
│  规格：180×200×6cm  睡感标签    │
├─────────────────────────────────┤
│  [分享] [小程序码] [选款]       │
├─────────────────────────────────┤
│  Tab: 产品详情 | 实拍图         │
├─────────────────────────────────┤
│  富文本内容 / 实拍图集          │
└─────────────────────────────────┘
```

**功能点详述**

**1. 产品轮播**
- **组件**：`<swiper>`，`indicator-dots="{{true}}"`
- **图片源**：`detail_images` 数组（后台上传的多张卖点图）
- **懒加载**：`<image lazy-load="true" />`

**2. 基础信息区**
- **字段展示**：
  - 产品名称（大标题）
  - Slogan（副标题，灰色小字）
  - 规格尺寸（如 `180×200×26cm`）
  - 睡感标签（圆角矩形 badge，背景色 `#FFE4E1`）

**3. 详情 Tab 切换**
- **组件**：`<van-tabs>` + `<van-tab>`
- **Tab 1 - 产品详情**：
  - 富文本渲染 `<rich-text nodes="{{detail_content}}" />`
  - 内容包含：面料、填充层、支撑结构、工艺参数等
- **Tab 2 - 实拍图**：
  - 瀑布流布局 `<masonry>` 组件
  - 图片数组 `real_images`

**4. 底部操作栏**
- **分享按钮**：调用 `wx.showShareMenu({ withShareTicket: true })`
- **选款按钮**：
  ```javascript
  addToSelection() {
    const store = useSelectionStore();
    store.addProduct(this.product);
    wx.showToast({ title: '已加入选品', icon: 'success' });
  }
  ```

### 3.4 方案中心模块

#### 3.4.1 方案编辑页 (`/pages/scheme/edit`)

**页面结构**
```
┌─────────────────────────────────┐
│  方案标题 [输入自定义标题]       │
├─────────────────────────────────┤
│  产品列表 [横向滚动卡片]         │
│  [产品1] [产品2] [+] (添加)     │
├─────────────────────────────────┤
│  产品数量：2                    │
├─────────────────────────────────┤
│  详细说明 [▼ 展开]              │
│  (折叠面板，可输入多行备注)      │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  我的方案  |  保存  |  预览分享  │
└─────────────────────────────────┘
```

**功能点详述**

**1. 标题编辑**
- **组件**：`<van-field>`，`placeholder="请输入方案标题"`
- **校验**：
  - 必填，长度 1-20 字
  - 保存时校验，为空则 `wx.showToast({ title: '请输入方案标题', icon: 'none' })`

**2. 产品管理**
- **已选产品展示**：
  - 横向滚动 `<scroll-view scroll-x>`
  - 每个产品卡片右上角 "×" 删除按钮
  - 点击删除需确认 `wx.showModal({ content: '确认移除该产品？' })`
- **添加产品**：
  - "+" 占位框点击跳转 `/pages/product/list`
  - 从列表页返回时，通过 `onShow()` 检查全局已选产品，更新当前页面

**3. 详细说明**
- **组件**：`<van-collapse>` + `<van-field type="textarea" />`
- **默认折叠**，点击展开后显示 4 行文本域
- **非必填**，用于记录客户需求（如"主卧，腰不好，预算1万"）

**4. 底部操作栏**
- **我的方案**：`wx.navigateTo({ url: '/pages/scheme/list' })`
- **保存**：
  ```javascript
  async saveScheme() {
    if (!this.title) return showToast('请输入标题');
    
    const res = await api.post('/schemes', {
      title: this.title,
      remark: this.remark,
      product_ids: this.selectedProducts.map(p => p.id)
    });
    
    this.schemeId = res.data.id;
    wx.showToast({ title: '保存成功' });
  }
  ```
- **预览分享**：
  - 先调用保存接口获取 `scheme_id`
  - 跳转 `/pages/scheme/preview?id={scheme_id}`

#### 3.4.2 方案列表页 (`/pages/scheme/list`)

**功能点详述**
- **数据源**：`GET /api/v1/schemes?page=1&size=20`（当前用户方案，按 `create_time desc` 排序）
- **方案卡片**：
  ```html
  <view class="scheme-card" bindtap="goToDetail" data-id="{{item.id}}">
    <image src="{{item.first_product_image}}" />
    <view class="info">
      <text class="title">{{item.title}}</text>
      <text class="meta">产品数量: {{item.product_count}} / 日期: {{item.create_date}}</text>
    </view>
  </view>
  ```
- **删除操作**：
  - **长按**卡片触发 `bindlongtap`
  - 弹出确认框 `wx.showModal({ content: '确认删除该方案？' })`
  - 确认后调用 `DELETE /api/v1/schemes/{id}`
- **空状态**：无方案时显示 `<van-empty description="暂无方案，快去创建吧" />` + "去选品"按钮

#### 3.4.3 方案预览页 (`/pages/scheme/preview`)

**功能点详述**
- **长流式展示**：
  - 顶部方案标题（大字号，居中）
  - 依次展示每个产品的完整海报（宽度 100%，高度自适应）
  - 产品海报包含：主图、名称、规格、睡感、核心参数
- **底部操作栏**：
  - **返回编辑**：`wx.navigateBack()`（仅方案创建者可看到）
  - **立即分享**：调用 `wx.showShareMenu()`，分享卡片路径 `/pages/scheme/preview?id={id}`
- **权限控制**：
  - 方案创建者：可看到"返回编辑"按钮
  - 访客（通过分享链接打开）：仅查看，无编辑/删除入口
  - 后端接口区分：`GET /api/v1/schemes/{id}/preview`（需登录） vs `GET /api/v1/schemes/{id}/public`（无需登录）

### 3.5 个人中心模块 (`/pages/user/index`)

**页面结构**
```
┌─────────────────────────────────┐
│  品牌介绍（图文）               │
├─────────────────────────────────┤
│  招商加盟                       │
│  [加入我们] 电话: 400-XXX-XXXX  │
├─────────────────────────────────┤
│  客服承诺                       │
│  ⚡ 3分钟响应   5分钟出方案   │
│  ⚡ 8分钟解决售后               │
├─────────────────────────────────┤
│  [我的方案] (快捷入口)          │
└─────────────────────────────────┘
```

**功能点详述**
- **品牌介绍**：
  - 数据源：`GET /api/v1/brand/info`
  - 展示字段：成立时间、总部位置、生产规模、门店数量、品牌定位文案
  - 配图：品牌门店形象图（后台配置）
- **招商加盟**：
  - "加入我们" 按钮调用 `wx.makePhoneCall({ phoneNumber: '400-XXX-XXXX' })`
  - 电话号后台可配置
- **客服承诺**：
  - 静态文案展示（或后台配置）
- **我的方案快捷入口**：
  - 点击跳转 `/pages/scheme/list`

---

## 4. 后端功能需求

### 4.1 管理后台核心功能

#### 4.1.1 内容管理

**1. 轮播图管理 (`/admin/banners`)**
- **列表页**：展示所有轮播图（缩略图、跳转类型、排序、状态、创建时间）
- **新增/编辑**：
  - 图片上传（拖拽上传，支持 JPG/PNG，最大 5MB）
  - 跳转类型下拉选择：无跳转、产品分类、指定产品、外链
  - 跳转目标值（根据类型动态显示：分类下拉、产品搜索、URL输入框）
  - 排序输入（数字，越小越靠前）
  - 状态开关（启用/禁用）
- **删除**：软删除（`status=0`），不物理删除记录

**2. 产品分类管理 (`/admin/categories`)**
- **列表页**：树形展示（目前扁平，预留父子级扩展）
- **字段**：分类名称、图标（上传）、排序、启用状态
- **约束**：系统预置 7 大分类，不允许删除，只允许禁用

**3. 产品管理 (`/admin/products`)**
- **列表页**：
  - 支持按分类、名称、型号、上下架状态筛选
  - 表格列：ID、主图、名称、型号、分类、规格、睡感、排序、状态、操作
- **新增/编辑**：
  - **基础信息**：
    - 产品名称（必填，最多 100 字）
    - 型号（必填，唯一，最多 50 字）
    - 所属分类（下拉选择）
    - Slogan（选填，最多 100 字）
    - 规格尺寸（选填，如 "180×200×26cm"）
    - 睡感标签（选填，如 "适中偏硬"）
    - 排序（数字，默认 0）
  - **素材管理**：
    - 主图（必填，单图上传）
    - 详情轮播图（多图上传，最多 10 张）
    - 实拍图（多图上传，最多 20 张）
    - 所有图片上传至 OSS/COS，返回 CDN URL
  - **产品参数**：
    - 富文本编辑器（wangEditor 或 TinyMCE）
    - 内容包含：面料、填充层、支撑结构、工艺等
  - **上下架控制**：开关（`status: 0=下架, 1=上架`）
- **批量操作**：批量上架、批量下架、批量删除

**4. 资讯与服务管理 (`/admin/articles`)**
- **列表页**：文章标题、分类（服务/资讯）、发布时间、状态
- **新增/编辑**：
  - 标题（必填）
  - 分类（服务板块/普通资讯）
  - 封面图（选填）
  - 富文本内容
- **发布**：立即发布/定时发布（预留）

**5. 品牌信息配置 (`/admin/brand`)**
- **单页表单**：
  - 品牌介绍文案（多行文本）
  - 加盟电话（数字校验）
  - 客服承诺文案（JSON 数组，如 `["3分钟响应", "5分钟出方案", "8分钟解决售后"]`）
  - 门店形象图（多图上传）

#### 4.1.2 用户管理 (`/admin/users`)
- **列表页**：
  - 列：ID、OpenID、昵称、头像、创建时间、最后登录时间、状态、操作
  - 支持按昵称、OpenID 搜索
- **操作**：
  - 启用/禁用账号（`status: 0=禁用, 1=启用`）
  - 查看该用户创建的所有方案（跳转方案详情）
- **注意**：不支持手动创建用户，仅同步小程序登录用户

#### 4.1.3 方案数据管理 (`/admin/schemes`)
- **列表页**：
  - 列：ID、方案标题、创建用户、产品数量、分享次数、创建时间、操作
  - 支持按用户、日期范围、产品筛选
- **详情查看**：
  - 展示方案完整信息（标题、备注、产品列表及快照）
  - 查看分享记录（分享时间、分享用户）
- **删除**：仅管理员可删除任意方案（软删除）
- **数据统计**（预留）：
  - 方案创建量（日/周/月趋势图）
  - 热门产品 Top 10（被加入方案次数）
  - 活跃导购 Top 10（创建方案数量）

#### 4.1.4 系统管理
- **管理员账号**：
  - 列表：用户名、角色、最后登录时间、状态
  - 新增/编辑：用户名、密码（加密）、角色、状态
- **角色权限**：
  - 预置角色：超级管理员、内容管理员、运营人员
  - 权限粒度：菜单级（可见性）、按钮级（操作权限）
- **操作日志**：
  - 记录：操作人、操作时间、IP、操作模块、操作内容、结果
  - 支持按时间、操作人、模块筛选

### 4.2 API 接口规范

#### 4.2.1 通用规范

**请求格式**
- **Content-Type**：`application/json`
- **认证**：Header 携带 `Authorization: Bearer {jwt_token}`（公开接口除外）
- **分页参数**：`?page=1&size=20`（默认第1页，每页20条）

**响应格式**
```json
{
  "code": 200,
  "msg": "success",
  "data": {},
  "timestamp": 1699999999999
}
```

**错误码定义**
| Code | 说明 | 处理建议 |
|------|------|---------|
| 200 | 成功 | - |
| 400 | 请求参数错误 | 检查参数格式 |
| 401 | 未登录/Token过期 | 跳转登录页 |
| 403 | 无权限 | 提示权限不足 |
| 404 | 资源不存在 | 检查ID是否正确 |
| 500 | 服务器内部错误 | 联系后端排查 |

#### 4.2.2 接口清单

**用户模块**
| 接口 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| 微信登录 | POST | `/api/v1/auth/login` | 否 | 传入 `code`，返回 `token, user_info` |
| 获取当前用户 | GET | `/api/v1/users/me` | 是 | 返回用户基础信息 |

**首页模块**
| 接口 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| 获取首页内容 | GET | `/api/v1/home` | 否 | 返回 `banners, categories, services` |

**产品模块**
| 接口 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| 获取分类列表 | GET | `/api/v1/categories` | 否 | 返回分类数组 |
| 获取产品列表 | GET | `/api/v1/products` | 否 | 支持 `category_id, keyword, sort, page, size` |
| 获取产品详情 | GET | `/api/v1/products/{id}` | 否 | 返回完整产品信息 |

**方案模块**
| 接口 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| 创建方案 | POST | `/api/v1/schemes` | 是 | 传入 `title, product_ids[], remark` |
| 更新方案 | PUT | `/api/v1/schemes/{id}` | 是 | 仅方案创建者可修改 |
| 获取方案列表 | GET | `/api/v1/schemes` | 是 | 返回当前用户方案列表 |
| 获取方案详情 | GET | `/api/v1/schemes/{id}` | 是 | 返回方案及产品快照 |
| 获取方案公开预览 | GET | `/api/v1/schemes/{id}/public` | 否 | 访客查看方案 |
| 删除方案 | DELETE | `/api/v1/schemes/{id}` | 是 | 软删除 |
| 记录分享 | POST | `/api/v1/schemes/{id}/share` | 是 | 分享成功后调用 |

**其他接口**
| 接口 | 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|------|
| 获取资讯列表 | GET | `/api/v1/articles` | 否 | 支持分页 |
| 获取资讯详情 | GET | `/api/v1/articles/{id}` | 否 | 返回富文本内容 |
| 获取品牌信息 | GET | `/api/v1/brand` | 否 | 返回个人中心配置 |

#### 4.2.3 关键接口示例

**创建方案**
```http
POST /api/v1/schemes
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "title": "主卧床垫方案",
  "remark": "客户腰不好，需要偏硬护脊款",
  "product_ids": [101, 103, 105]
}

Response 201 Created:
{
  "code": 201,
  "msg": "创建成功",
  "data": {
    "id": 88,
    "title": "主卧床垫方案",
    "product_count": 3,
    "create_time": "2024-11-05T10:00:00Z"
  }
}
```

**获取产品列表**
```http
GET /api/v1/products?category_id=3&keyword=卷绵&sort=new&size=10

Response 200 OK:
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 101,
        "name": "卷绵1号护脊款",
        "model": "JM-001",
        "main_image": "https://cdn.example.com/p101.jpg",
        "spec": "180×200×26cm",
        "sleep_feel": "适中偏硬",
        "tags": ["护脊", "双面可用"]
      }
    ],
    "total": 25,
    "page": 1,
    "size": 10
  }
}
```

### 4.3 核心业务逻辑

#### 4.3.1 方案快照机制
**问题**：产品信息更新后，历史方案展示旧数据还是新数据？  
**方案**：保存方案时，固化当前产品信息生成 JSON 快照。

**实现**：
```python
# backend/app/services/scheme_service.py
async def create_scheme(user_id: int, title: str, product_ids: list[str], remark: str):
    # 1. 创建方案主记录
    scheme = Scheme(user_id=user_id, title=title, remark=remark)
    db.add(scheme)
    await db.commit()
    await db.refresh(scheme)
    
    # 2. 为每个产品生成快照
    for idx, product_id in enumerate(product_ids):
        product = await db.get(Product, product_id)
        if not product:
            raise HTTPException(404, f"产品 {product_id} 不存在")
        
        # 快照包含所有展示字段
        snapshot = {
            "id": product.id,
            "name": product.name,
            "model": product.model,
            "main_image": product.main_image,
            "spec": product.spec,
            "sleep_feel": product.sleep_feel,
            "detail_content": product.detail_content,
            # ... 其他字段
        }
        
        scheme_product = SchemeProduct(
            scheme_id=scheme.id,
            product_id=product.id,
            product_snapshot=snapshot,  # JSON 字段
            sort=idx
        )
        db.add(scheme_product)
    
    await db.commit()
    return scheme
```

**优点**：
- 历史方案永远保持创建时的状态
- 产品更新不影响已分享方案
- 快照 JSON 可完整还原产品详情

#### 4.3.2 鉴权逻辑
**接口分类**：
1. **公开接口**（无需 Token）：
   - 首页内容、产品列表/详情、资讯、品牌信息
   - 方案公开预览 `GET /schemes/{id}/public`
2. **需登录接口**：
   - 方案 CRUD、用户信息、分享统计

**权限校验**：
```python
# backend/app/core/security.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, "Invalid token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(401, "Token expired")

# 方案操作校验
async def check_scheme_owner(scheme_id: int, current_user_id: int = Depends(get_current_user)):
    scheme = await db.get(Scheme, scheme_id)
    if not scheme:
        raise HTTPException(404, "方案不存在")
    if scheme.user_id != current_user_id:
        raise HTTPException(403, "无权操作他人方案")
    return scheme
```

#### 4.3.3 分享逻辑
**分享流程**：
1. 用户点击"分享" → 小程序调用 `wx.showShareMenu()`
2. 生成分享卡片，路径为 `/pages/scheme/preview?id={scheme_id}`
3. 好友点击卡片 → 打开小程序 → 调用 `GET /api/v1/schemes/{id}/public`
4. 后端查询方案及快照（**无需登录**）
5. 前端展示只读预览页（隐藏编辑/删除按钮）

**分享统计**：
```python
# 分享成功后调用
async def record_share(scheme_id: int):
    scheme = await db.get(Scheme, scheme_id)
    scheme.share_count += 1
    await db.commit()
```

---

## 5. 数据模型设计

### 5.1 数据库选型
- **主数据库**：MySQL 8.0（InnoDB 引擎，UTF8MB4 字符集）
- **缓存**：Redis 7.x（会话、热点数据、任务队列）
- **文件存储**：阿里云 OSS / 腾讯云 COS（图片、视频）

### 5.2 核心表结构

#### 5.2.1 产品分类表 (`product_category`)
```sql
CREATE TABLE product_category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    name VARCHAR(50) NOT NULL COMMENT '分类名称',
    icon VARCHAR(255) DEFAULT NULL COMMENT '分类图标URL',
    parent_id BIGINT DEFAULT NULL COMMENT '父分类ID（预留）',
    sort INT DEFAULT 0 COMMENT '排序值，越小越靠前',
    status TINYINT DEFAULT 1 COMMENT '启用状态：0禁用 1启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_sort (sort),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品分类表';
```

**SQLModel 定义**：
```python
# backend/app/models/category.py
from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional

class ProductCategory(SQLModel, table=True):
    __tablename__ = "product_category"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=50)
    icon: Optional[str] = Field(default=None, max_length=255)
    parent_id: Optional[int] = Field(default=None)
    sort: int = Field(default=0)
    status: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
```

#### 5.2.2 产品表 (`product`)
```sql
CREATE TABLE product (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    category_id BIGINT NOT NULL COMMENT '所属分类ID',
    name VARCHAR(100) NOT NULL COMMENT '产品名称',
    model VARCHAR(50) NOT NULL COMMENT '产品型号',
    slogan VARCHAR(100) DEFAULT NULL COMMENT '产品标语',
    spec VARCHAR(50) DEFAULT NULL COMMENT '规格尺寸',
    sleep_feel VARCHAR(20) DEFAULT NULL COMMENT '睡感标签',
    main_image VARCHAR(255) NOT NULL COMMENT '主图URL',
    detail_images JSON DEFAULT NULL COMMENT '详情轮播图JSON数组',
    real_images JSON DEFAULT NULL COMMENT '实拍图JSON数组',
    detail_content LONGTEXT DEFAULT NULL COMMENT '产品详情富文本',
    sort INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '上下架状态：0下架 1上架',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (category_id) REFERENCES product_category(id),
    UNIQUE KEY uk_model (model),
    INDEX idx_category (category_id),
    INDEX idx_status (status),
    INDEX idx_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品表';
```

**SQLModel 定义**：
```python
# backend/app/models/product.py
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import json

class Product(SQLModel, table=True):
    __tablename__ = "product"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="product_category.id")
    name: str = Field(max_length=100)
    model: str = Field(max_length=50, unique=True)
    slogan: Optional[str] = Field(default=None, max_length=100)
    spec: Optional[str] = Field(default=None, max_length=50)
    sleep_feel: Optional[str] = Field(default=None, max_length=20)
    main_image: str = Field(max_length=255)
    detail_images: Optional[str] = Field(default=None)  # JSON string
    real_images: Optional[str] = Field(default=None)  # JSON string
    detail_content: Optional[str] = Field(default=None)  # Long text
    sort: int = Field(default=0)
    status: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationship
    category: "ProductCategory" = Relationship(back_populates="products")
    
    # Helper methods
    def get_detail_images(self) -> List[str]:
        return json.loads(self.detail_images) if self.detail_images else []
    
    def get_real_images(self) -> List[str]:
        return json.loads(self.real_images) if self.real_images else []
```

#### 5.2.3 用户表 (`user`)
```sql
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    openid VARCHAR(64) NOT NULL UNIQUE COMMENT '微信openid',
    nickname VARCHAR(100) DEFAULT NULL COMMENT '微信昵称',
    avatar VARCHAR(255) DEFAULT NULL COMMENT '头像URL',
    status TINYINT DEFAULT 1 COMMENT '账号状态：0禁用 1启用',
    last_login_at DATETIME DEFAULT NULL COMMENT '最后登录时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_openid (openid),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

#### 5.2.4 方案表 (`scheme`)
```sql
CREATE TABLE scheme (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    user_id BIGINT NOT NULL COMMENT '创建用户ID',
    title VARCHAR(100) NOT NULL COMMENT '方案标题',
    remark TEXT DEFAULT NULL COMMENT '详细说明',
    product_count INT DEFAULT 0 COMMENT '产品数量',
    share_count INT DEFAULT 0 COMMENT '分享次数',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    FOREIGN KEY (user_id) REFERENCES user(id),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='方案表';
```

#### 5.2.5 方案产品快照表 (`scheme_product`)
```sql
CREATE TABLE scheme_product (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    scheme_id BIGINT NOT NULL COMMENT '方案ID',
    product_id BIGINT NOT NULL COMMENT '原产品ID',
    product_snapshot JSON NOT NULL COMMENT '产品信息快照',
    sort INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (scheme_id) REFERENCES scheme(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES product(id),
    INDEX idx_scheme (scheme_id),
    INDEX idx_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='方案产品快照表';
```

**SQLModel 定义**：
```python
# backend/app/models/scheme.py
from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import json

class Scheme(SQLModel, table=True):
    __tablename__ = "scheme"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    title: str = Field(max_length=100)
    remark: Optional[str] = None
    product_count: int = Field(default=0)
    share_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    user: "User" = Relationship(back_populates="schemes")
    products: List["SchemeProduct"] = Relationship(back_populates="scheme")

class SchemeProduct(SQLModel, table=True):
    __tablename__ = "scheme_product"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    scheme_id: int = Field(foreign_key="scheme.id")
    product_id: int = Field(foreign_key="product.id")
    product_snapshot: str = Field(sa_column=Column(JSON))  # JSON field
    sort: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    scheme: Scheme = Relationship(back_populates="products")
    
    def get_snapshot(self) -> dict:
        return self.product_snapshot if isinstance(self.product_snapshot, dict) else json.loads(self.product_snapshot)
```

#### 5.2.6 轮播图表 (`banner`)
```sql
CREATE TABLE banner (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '主键',
    image VARCHAR(255) NOT NULL COMMENT '图片URL',
    jump_type TINYINT DEFAULT 1 COMMENT '跳转类型：1无 2分类 3产品 4外链',
    jump_value VARCHAR(255) DEFAULT NULL COMMENT '跳转目标值',
    sort INT DEFAULT 0 COMMENT '排序',
    status TINYINT DEFAULT 1 COMMENT '状态：0禁用 1启用',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_sort (sort),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='轮播图表';
```

### 5.3 数据库索引优化建议
1. **高频查询字段**：
   - `product.category_id`, `product.status` → 复合索引 `idx_category_status`
   - `scheme.user_id`, `scheme.created_at` → 复合索引 `idx_user_created`
2. **全文搜索**（可选）：
   - `product.name`, `product.model` → 全文索引（MySQL FULLTEXT）
3. **外键索引**：
   - 所有外键字段自动创建索引（MySQL 8.0 默认行为）

---

## 6. 非功能需求

### 6.1 性能需求
| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| **首屏加载时间** | ≤ 1.5s | 小程序启动到首页渲染完成 |
| **接口响应时间** | P95 ≤ 300ms | 后端 APM 监控（如 Sentry） |
| **图片加载** | 懒加载，WebP 格式 | 使用 `<image lazy-load>` + CDN 自动压缩 |
| **并发能力** | 支持 100 QPS | 压测工具（如 Apache Bench） |
| **数据库查询** | 单表查询 ≤ 50ms | MySQL slow query log |

**优化措施**：
- **CDN 加速**：所有图片、视频走 OSS/COS CDN
- **缓存策略**：
  - 首页内容缓存 5 分钟（Redis）
  - 产品分类缓存 1 小时
  - 产品详情缓存 30 分钟（热点产品）
- **分页加载**：列表接口强制分页，单页最大 50 条
- **数据库连接池**：SQLAlchemy Async Engine，`pool_size=10, max_overflow=20`

### 6.2 兼容性需求
| 平台 | 最低版本 | 适配要求 |
|------|---------|---------|
| **微信基础库** | ≥ 2.20.0 | 使用 `wx.getSystemInfoSync()` 检测 |
| **iOS** | iOS 12+ | 适配 iPhone X 及以上（安全区） |
| **Android** | Android 6.0+ | 适配主流分辨率（720p/1080p） |
| **浏览器**（管理后台） | Chrome 90+, Safari 14+ | 使用 Vite 自动 polyfill |

**测试矩阵**：
- iPhone 12/13/14/15 系列（刘海屏、灵动岛）
- 华为、小米、OPPO、vivo 主流机型
- iPad（横竖屏适配）

### 6.3 安全需求
1. **接口鉴权**：
   - 所有业务接口必须携带 JWT Token
   - Token 有效期 7 天，支持刷新
   - 防止越权：后端校验 `scheme.user_id == current_user.id`
2. **数据传输**：
   - 全站 HTTPS（TLS 1.2+）
   - 敏感信息（如手机号）加密传输
3. **文件上传**：
   - 限制文件类型（JPG/PNG/MP4）
   - 限制文件大小（图片 5MB，视频 100MB）
   - OSS/COS 防盗链（Referer 白名单）
4. **SQL 注入防护**：
   - 使用 SQLAlchemy 参数化查询
   - 禁止拼接 SQL 字符串
5. **XSS 防护**：
   - 富文本内容使用 `bleach` 库过滤危险标签
   - 管理后台输入校验
6. **操作审计**：
   - 后台所有增删改操作记录日志
   - 日志包含：操作人、IP、时间、操作内容

### 6.4 可用性需求
| 指标 | 目标值 | 保障措施 |
|------|--------|---------|
| **核心功能可用性** | ≥ 99.5% | 云服务器 SLA + 健康检查 |
| **图片加载成功率** | ≥ 99% | CDN 多节点 + 默认占位图 |
| **接口错误率** | ≤ 0.5% | 异常监控（Sentry）+ 自动告警 |
| **数据持久性** | ≥ 99.999999999% | MySQL 主从 + 每日备份 |

**容灾方案**：
- **数据库备份**：
  - 每日凌晨 3 点全量备份（mysqldump）
  - 备份文件上传至 OSS，保留 7 天
  - 支持一键恢复
- **服务器故障**：
  - 云服务器快照（每周）
  - Docker 镜像推送至私有仓库
  - 30 分钟内可在新服务器恢复

### 6.5 可维护性需求
1. **代码规范**：
   - 后端：遵循 PEP 8，使用 `ruff` 自动 lint
   - 前端：使用 ESLint + Prettier
   - TypeScript 严格模式（`strict: true`）
2. **日志系统**：
   - 结构化日志（JSON 格式）
   - 分级：DEBUG/INFO/WARNING/ERROR
   - 错误日志自动上报 Sentry
3. **API 文档**：
   - FastAPI 自动生成 Swagger UI（`/docs`）
   - 接口注释完整（Summary + Description）
4. **版本管理**：
   - Git 分支策略：`main`（生产）、`develop`（开发）、`feature/*`（功能）
   - 语义化版本（SemVer）：`v1.0.0`

---

## 7. 部署与运维

### 7.1 环境规划
| 环境 | 用途 | 域名 | 服务器配置 |
|------|------|------|-----------|
| **开发环境** | 本地开发 | localhost | 本地 Docker |
| **测试环境** | 功能测试、联调 | test-api.yourdomain.com | 2C4G |
| **生产环境** | 正式商用 | api.yourdomain.com | 4C8G |

### 7.2 Docker Compose 配置

**文件结构**：
```
backend/
├── Dockerfile
├── docker-compose.yml
├── .env
└── app/
    ├── main.py
    ├── models/
    ├── schemas/
    ├── services/
    └── api/
```

**docker-compose.yml**：
```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: mattress_mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    container_name: mattress_redis
    restart: always
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}

  api:
    build: .
    container_name: mattress_api
    restart: always
    depends_on:
      - mysql
      - redis
    environment:
      DATABASE_URL: mysql+aiomysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    command: gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
    ports:
      - "8000:8000"

  worker:
    build: .
    container_name: mattress_worker
    restart: always
    depends_on:
      - redis
    command: arq app.worker.WorkerSettings

  nginx:
    image: nginx:alpine
    container_name: mattress_nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./ssl:/etc/nginx/ssl
      - ../frontend/dist:/usr/share/nginx/html/admin
    depends_on:
      - api

volumes:
  mysql_data:
```

### 7.3 Nginx 配置

**文件**：`nginx/conf.d/default.conf`
```nginx
# 管理后台
server {
    listen 443 ssl;
    server_name admin.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/admin.pem;
    ssl_certificate_key /etc/nginx/ssl/admin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        root /usr/share/nginx/html/admin;
        index index.html;
        try_files $uri $uri/ /index.html;  # Vue Router history mode
        
        # Gzip 压缩
        gzip on;
        gzip_types text/plain text/css application/json application/javascript;
    }
    
    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# API 接口
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/nginx/ssl/api.pem;
    ssl_certificate_key /etc/nginx/ssl/api.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # 限制请求体大小
    client_max_body_size 10M;
    
    location / {
        proxy_pass http://api:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}

# HTTP 强制跳转 HTTPS
server {
    listen 80;
    server_name admin.yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}
```

### 7.4 CI/CD 流程

**GitHub Actions 示例**（`.github/workflows/deploy.yml`）：
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build and Deploy
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/mattress-app
            git pull origin main
            
            # Build frontend
            cd frontend
            npm install
            npm run build
            cd ..
            
            # Restart containers
            docker-compose down
            docker-compose up -d --build
            
            # Clean up old images
            docker image prune -f
```

### 7.5 监控与告警

1. **应用监控**：
   - **Sentry**：错误追踪（前端 + 后端）
   - **Prometheus + Grafana**：系统指标（CPU、内存、QPS）
2. **日志收集**：
   - 后端日志：`/var/log/mattress/api.log`（按天切割）
   - Nginx 日志：`/var/log/nginx/access.log`
3. **告警规则**：
   - CPU 使用率 > 85% 持续 5 分钟 → 邮件告警
   - 接口错误率 > 5% → 企业微信机器人通知
   - 磁盘使用率 > 90% → 短信告警

### 7.6 备份策略

**数据库备份脚本**（`backup.sh`）：
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="mattress_${DATE}.sql.gz"

# 备份数据库
docker exec mattress_mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} ${MYSQL_DATABASE} | gzip > ${BACKUP_DIR}/${BACKUP_FILE}

# 上传至 OSS
ossutil cp ${BACKUP_DIR}/${BACKUP_FILE} oss://your-bucket/backups/

# 删除本地7天前的备份
find ${BACKUP_DIR} -name "mattress_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}"
```

**Crontab 配置**：
```bash
# 每天凌晨3点执行备份
0 3 * * * /opt/mattress-app/backup.sh >> /var/log/backup.log 2>&1
```

---

### 8.2 验收标准

**功能验收**：
- [ ] 所有需求文档中的功能点已实现
- [ ] 核心流程（选品→建方案→分享）可完整走通
- [ ] 无 P0/P1 级别 Bug（P2 Bug ≤ 5 个）

**性能验收**：
- [ ] 首屏加载 ≤ 1.5s（4G 网络）
- [ ] 接口 P95 响应时间 ≤ 300ms
- [ ] 支持 100 并发用户

**安全验收**：
- [ ] 所有接口已添加鉴权
- [ ] 无 SQL 注入、XSS 漏洞
- [ ] HTTPS 已启用且证书有效

**文档验收**：
- [ ] API 文档（Swagger）完整
- [ ] 部署文档（README）清晰
- [ ] 用户操作手册（可选）

### 8.3 测试用例示例

**用例 1：创建方案**
```
前置条件：用户已登录
步骤：
1. 进入首页，点击"选款"悬浮按钮
2. 在产品列表页勾选 3 个产品
3. 点击底部"OK"按钮
4. 输入方案标题"主卧床垫方案"
5. 点击"保存"按钮

预期结果：
- 提示"保存成功"
- 方案列表页出现新方案
- 方案产品数量显示为 3
```

**用例 2：分享方案**
```
前置条件：已创建方案
步骤：
1. 进入方案预览页
2. 点击右上角"分享"按钮
3. 选择微信好友发送
4. 好友点击分享卡片

预期结果：
- 分享卡片显示方案标题和封面图
- 好友打开后看到方案详情（只读）
- 方案分享次数 +1
```

---


### 10.2 术语表
- **SPU**：Standard Product Unit，标准产品单元
- **SKU**：Stock Keeping Unit，库存量单位
- **JWT**：JSON Web Token，身份认证令牌
- **OSS**：Object Storage Service，对象存储服务
- **CDN**：Content Delivery Network，内容分发网络

