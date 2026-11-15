/**
 * BE-09 数据与系统管理类型定义。
 * 字段与 backend/src/schemas/admin_system.py 一一对应
 * （时间字段对外为 create_time/update_time）。
 */

// ---------------- 小程序用户 ----------------

export interface WxUserItem {
  id: number
  openid: string
  nickname: string | null
  avatar: string | null
  /** 0 禁用 / 1 启用 */
  status: number
  create_time: string
  update_time: string
  last_login_at: string | null
  /** 该用户未删除方案数 */
  scheme_count: number
}

export interface WxUserPage {
  items: WxUserItem[]
  total: number
  page: number
  size: number
}

export interface WxUserQuery {
  page?: number
  size?: number
  /** 昵称或 OpenID 模糊搜索 */
  keyword?: string
  /** 0 禁用 / 1 启用；不传=全部 */
  status?: 0 | 1 | null
}

// ---------------- 方案数据 ----------------

export interface AdminSchemeProductItem {
  id: number
  product_id: number
  name: string
  main_image: string | null
  slogan: string | null
  spec: string | null
  sort: number
}

export interface AdminSchemeItem {
  id: number
  title: string
  user_id: number
  user_nickname: string | null
  user_openid: string | null
  product_count: number
  share_count: number
  create_time: string
  update_time: string
  /** 软删除时间；null=正常。管理端列表含已删方案，靠它区分。 */
  deleted_at: string | null
}

export interface AdminSchemeDetail extends AdminSchemeItem {
  remark: string | null
  products: AdminSchemeProductItem[]
}

export interface AdminSchemePage {
  items: AdminSchemeItem[]
  total: number
  page: number
  size: number
}

export interface AdminSchemeQuery {
  page?: number
  size?: number
  user_id?: number | null
  keyword?: string
  /** ISO 时间字符串 */
  start_time?: string
  end_time?: string
}

// ---------------- 预置角色 ----------------

export type PresetRoleKey = 'super_admin' | 'content_admin' | 'operator'

export interface PresetRoleItem {
  key: PresetRoleKey
  name: string
  desc: string
  exists: boolean
  role_id: number | null
  menu_paths: string[]
}
