import http, { request } from '@/api/request'
import type {
  Article,
  ArticleCreate,
  ArticlePage,
  ArticleQuery,
  ArticleUpdate,
  Banner,
  BannerCreate,
  BannerUpdate,
  BrandInfo,
  BrandInfoUpdate,
  Category,
  CategoryCreate,
  CategoryUpdate,
  ImageUploadResult,
  Product,
  ProductCreate,
  ProductPage,
  ProductQuery,
  ProductUpdate,
} from '@/types/content'

/**
 * BE-08 内容管理 API（挂载于后端 /api/v1/admin/*，见 backend/src/api/v1/admin/__init__.py）。
 * 所有函数返回信封 data（{code,msg,data} 由 request.ts 统一拆包）。
 */

// ---------------- 图片上传 ----------------

/** POST /admin/upload/image（multipart，字段名 file；OSS 适配层本地 mock，返回相对 URL /uploads/...） */
export async function uploadImage(file: File): Promise<ImageUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post<{ code: number; msg: string | null; data: ImageUploadResult }>(
    '/admin/upload/image',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  if (response.data.code !== 200) {
    throw new Error(response.data.msg || '上传失败')
  }
  return response.data.data
}

// ---------------- 轮播图 ----------------

export function listBanners(): Promise<Banner[]> {
  return request<Banner[]>({ url: '/admin/banners', method: 'GET' })
}

export function createBanner(payload: BannerCreate): Promise<Banner> {
  return request<Banner>({ url: '/admin/banners', method: 'POST', data: payload })
}

export function updateBanner(id: number, payload: BannerUpdate): Promise<Banner> {
  return request<Banner>({ url: `/admin/banners/${id}`, method: 'PUT', data: payload })
}

/** PUT /admin/banners/{id}/status（StatusToggle：0 禁用 / 1 启用） */
export function toggleBannerStatus(id: number, status: 0 | 1): Promise<Banner> {
  return request<Banner>({ url: `/admin/banners/${id}/status`, method: 'PUT', data: { status } })
}

/** 软删除：后端置 status=0（DELETE /admin/banners/{id}） */
export function deleteBanner(id: number): Promise<null> {
  return request<null>({ url: `/admin/banners/${id}`, method: 'DELETE' })
}

// ---------------- 产品分类 ----------------

export function listCategories(): Promise<Category[]> {
  return request<Category[]>({ url: '/admin/categories', method: 'GET' })
}

export function createCategory(payload: CategoryCreate): Promise<Category> {
  return request<Category>({ url: '/admin/categories', method: 'POST', data: payload })
}

export function updateCategory(id: number, payload: CategoryUpdate): Promise<Category> {
  return request<Category>({ url: `/admin/categories/${id}`, method: 'PUT', data: payload })
}

/** PUT /admin/categories/{id}/status（预置分类的『删除』替代：只许禁用） */
export function toggleCategoryStatus(id: number, status: 0 | 1): Promise<Category> {
  return request<Category>({
    url: `/admin/categories/${id}/status`,
    method: 'PUT',
    data: { status },
  })
}

/** 预置分类/有产品的分类后端 400 拒绝；前端对 is_preset 隐藏删除入口 */
export function deleteCategory(id: number): Promise<null> {
  return request<null>({ url: `/admin/categories/${id}`, method: 'DELETE' })
}

// ---------------- 产品 ----------------

export function listProducts(params: ProductQuery): Promise<ProductPage> {
  return request<ProductPage>({ url: '/admin/products', method: 'GET', params })
}

export function getProduct(id: number): Promise<Product> {
  return request<Product>({ url: `/admin/products/${id}`, method: 'GET' })
}

export function createProduct(payload: ProductCreate): Promise<Product> {
  return request<Product>({ url: '/admin/products', method: 'POST', data: payload })
}

export function updateProduct(id: number, payload: ProductUpdate): Promise<Product> {
  return request<Product>({ url: `/admin/products/${id}`, method: 'PUT', data: payload })
}

/** POST /admin/products/batch-status（ids ≤100，status 0 下架 / 1 上架） */
export function batchProductStatus(
  ids: number[],
  status: 0 | 1,
): Promise<{ updated: number }> {
  return request<{ updated: number }>({
    url: '/admin/products/batch-status',
    method: 'POST',
    data: { ids, status },
  })
}

// ---------------- 资讯与服务 ----------------

export function listArticles(params: ArticleQuery): Promise<ArticlePage> {
  return request<ArticlePage>({ url: '/admin/articles', method: 'GET', params })
}

export function getArticle(id: number): Promise<Article> {
  return request<Article>({ url: `/admin/articles/${id}`, method: 'GET' })
}

export function createArticle(payload: ArticleCreate): Promise<Article> {
  return request<Article>({ url: '/admin/articles', method: 'POST', data: payload })
}

export function updateArticle(id: number, payload: ArticleUpdate): Promise<Article> {
  return request<Article>({ url: `/admin/articles/${id}`, method: 'PUT', data: payload })
}

/** PUT /admin/articles/{id}/status（0 下线 / 1 发布） */
export function toggleArticleStatus(id: number, status: 0 | 1): Promise<Article> {
  return request<Article>({ url: `/admin/articles/${id}/status`, method: 'PUT', data: { status } })
}

/** 软删除：后端下线 status=0 */
export function deleteArticle(id: number): Promise<null> {
  return request<null>({ url: `/admin/articles/${id}`, method: 'DELETE' })
}

// ---------------- 品牌信息 ----------------

/** GET /admin/brand（单行；从未保存过时 data 为 null） */
export function getBrandInfo(): Promise<BrandInfo | null> {
  return request<BrandInfo | null>({ url: '/admin/brand', method: 'GET' })
}

export function updateBrandInfo(payload: BrandInfoUpdate): Promise<BrandInfo> {
  return request<BrandInfo>({ url: '/admin/brand', method: 'PUT', data: payload })
}
