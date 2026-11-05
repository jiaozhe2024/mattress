import { request } from '@/api/request'
import type { LoginResult, RoleAuthorized, UserInfo } from '@/types/api'

/** POST /base/access_token 登录（后端限流 5 次/分钟） */
export function login(username: string, password: string): Promise<LoginResult> {
  return request<LoginResult>({
    url: '/base/access_token',
    method: 'POST',
    data: { username, password },
  })
}

/** GET /base/userinfo 当前登录用户（含 is_superuser 与 roles 浅列表） */
export function getUserInfo(): Promise<UserInfo> {
  return request<UserInfo>({ url: '/base/userinfo', method: 'GET' })
}

/** GET /role/authorized 角色详情（含该角色绑定的 menus / apis，RBAC 菜单过滤数据源） */
export function getRoleAuthorized(roleId: number): Promise<RoleAuthorized> {
  return request<RoleAuthorized>({
    url: '/role/authorized',
    method: 'GET',
    params: { id: roleId },
  })
}
