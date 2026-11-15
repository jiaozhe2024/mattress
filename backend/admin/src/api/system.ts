import { request } from '@/api/request'
import type {
  AdminSchemeDetail,
  AdminSchemePage,
  AdminSchemeQuery,
  PresetRoleItem,
  WxUserItem,
  WxUserPage,
  WxUserQuery,
} from '@/types/system'

/**
 * BE-09 数据与系统管理 API（挂载于后端 /api/v1/admin/*）。
 * 所有函数返回信封 data（{code,msg,data} 由 request.ts 统一拆包）。
 */

// ---------------- 小程序用户 ----------------

/** GET /admin/wx-users（昵称/OpenID 搜索 + 状态筛选） */
export function listWxUsers(params: WxUserQuery): Promise<WxUserPage> {
  return request<WxUserPage>({ url: '/admin/wx-users', method: 'GET', params })
}

/** PUT /admin/wx-users/{id}/status（0 禁用 / 1 启用；禁用后该用户无法登录） */
export function setWxUserStatus(id: number, status: 0 | 1): Promise<WxUserItem> {
  return request<WxUserItem>({
    url: `/admin/wx-users/${id}/status`,
    method: 'PUT',
    data: { status },
  })
}

/** GET /admin/wx-users/{id}/schemes（点用户跳转其方案列表） */
export function listUserSchemes(
  id: number,
  params: { page?: number; size?: number } = {},
): Promise<AdminSchemePage> {
  return request<AdminSchemePage>({
    url: `/admin/wx-users/${id}/schemes`,
    method: 'GET',
    params,
  })
}

// ---------------- 方案数据 ----------------

/** GET /admin/schemes（按用户/日期/标题筛选，含已软删除） */
export function listSchemes(params: AdminSchemeQuery): Promise<AdminSchemePage> {
  return request<AdminSchemePage>({ url: '/admin/schemes', method: 'GET', params })
}

/** GET /admin/schemes/{id}（含快照产品列表；可查看已删方案） */
export function getScheme(id: number): Promise<AdminSchemeDetail> {
  return request<AdminSchemeDetail>({ url: `/admin/schemes/${id}`, method: 'GET' })
}

/** DELETE /admin/schemes/{id}（软删除；删除后 wxapi public 接口 404） */
export function deleteScheme(id: number): Promise<null> {
  return request<null>({ url: `/admin/schemes/${id}`, method: 'DELETE' })
}

// ---------------- 预置角色 ----------------

/** GET /admin/preset-roles（只读视图；增删改走基座 /role 与 /menu） */
export function listPresetRoles(): Promise<PresetRoleItem[]> {
  return request<PresetRoleItem[]>({ url: '/admin/preset-roles', method: 'GET' })
}
