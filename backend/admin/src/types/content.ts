/**
 * BE-08 内容管理类型定义。
 * 字段与 backend/src/schemas/admin_content.py 一一对应（时间字段对外为 create_time/update_time）。
 */

/** 轮播图跳转类型：1 无 / 2 分类 / 3 产品 / 4 外链（后端 BannerCreate.check_jump_type） */
export type BannerJumpType = 1 | 2 | 3 | 4

export interface Banner {
  id: number
  image: string
  jump_type: BannerJumpType
  jump_value: string | null
  sort: number
  status: number
  create_time: string | null
  update_time: string | null
}

export interface BannerCreate {
  image: string
  jump_type: BannerJumpType
  jump_value?: string | null
  sort: number
  status: number
}

export type BannerUpdate = Partial<BannerCreate>

export interface Category {
  id: number
  name: string
  subtitle: string | null
  icon: string | null
  banner_image: string | null
  sort: number
  status: number
  is_preset: boolean
  product_count: number
  create_time: string | null
  update_time: string | null
}

export interface CategoryCreate {
  name: string
  subtitle?: string | null
  icon?: string | null
  banner_image?: string | null
  sort: number
  status: number
}

export type CategoryUpdate = Partial<CategoryCreate>

export interface Product {
  id: number
  category_id: number
  category_name: string | null
  name: string
  model: string
  slogan: string | null
  spec: string | null
  sleep_feel: string | null
  main_image: string
  detail_images: string[] | null
  real_images: string[] | null
  detail_content: string | null
  sort: number
  status: number
  create_time: string | null
  update_time: string | null
}

export interface ProductCreate {
  category_id: number
  name: string
  model: string
  slogan?: string | null
  spec?: string | null
  sleep_feel?: string | null
  main_image: string
  detail_images?: string[] | null
  real_images?: string[] | null
  detail_content?: string | null
  sort: number
  status: number
}

export type ProductUpdate = Partial<ProductCreate>

export interface ProductQuery {
  page: number
  size: number
  category_id?: number | null
  name?: string | null
  model?: string | null
  status?: number | null
}

export interface ProductPage {
  items: Product[]
  total: number
  page: number
  size: number
}

/** 文章分类：news 宝顿资讯 / service 服务板块（后端 Literal["news","service"]） */
export type ArticleCategory = 'news' | 'service'

export interface Article {
  id: number
  title: string
  category: ArticleCategory
  cover: string | null
  content: string | null
  status: number
  create_time: string | null
  update_time: string | null
}

export interface ArticleCreate {
  title: string
  category: ArticleCategory
  cover?: string | null
  content?: string | null
  status: number
}

export type ArticleUpdate = Partial<ArticleCreate>

export interface ArticleQuery {
  page: number
  size: number
  category?: ArticleCategory | null
  title?: string | null
  status?: number | null
}

export interface ArticlePage {
  items: Article[]
  total: number
  page: number
  size: number
}

/** 品牌信息（单行配置，GET 缺失时 data 为 null） */
export interface BrandInfo {
  id: number
  intro: string | null
  join_phone: string | null
  service_promise: string[] | null
  store_images: string[] | null
  update_time: string | null
}

export interface BrandInfoUpdate {
  intro?: string | null
  join_phone?: string | null
  service_promise?: string[] | null
  store_images?: string[] | null
}

/** POST /admin/upload/image 的 data（ImageUploadOut） */
export interface ImageUploadResult {
  url: string
  size: number
}

/** 通用状态开关载荷（StatusToggle，软删除=置 0） */
export interface StatusTogglePayload {
  status: 0 | 1
}
