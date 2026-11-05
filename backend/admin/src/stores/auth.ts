import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getRoleAuthorized, getUserInfo, login as loginApi } from '@/api/auth'
import type { UserInfo } from '@/types/api'
import { normalizeBackendMenuPaths } from '@/utils/menu'
import { clearTokens, getAccessToken, saveTokens } from '@/utils/storage'

/**
 * 认证 + RBAC 状态（Pinia setup store，状态只读暴露，变更走 action，不直接改引用）
 *
 * allowedMenuPaths：
 * - 'all'  → 超级管理员（后端 is_superuser=true，RBAC 全放行）
 * - Set<string> → 普通用户：各角色 GET /role/authorized 返回 menus 的 path 并集
 *
 * 说明：基座 /base/usermenu 聚合接口在模板中被注释未启用（见 sprint_output 契约缺口），
 * 因此前端按角色逐个拉取 role/authorized 求并集。角色接口 403/失败时降级为空集合
 * （只显示 alwaysAllow 菜单），不阻塞登录。
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string>(getAccessToken())
  const userInfo = ref<UserInfo | null>(null)
  const allowedMenuPaths = ref<Set<string> | 'all'>(new Set<string>())

  const isLoggedIn = computed(() => accessToken.value !== '')
  const isSuperuser = computed(() => userInfo.value?.is_superuser === true)
  const displayName = computed(
    () => userInfo.value?.alias || userInfo.value?.username || '未知用户',
  )

  async function login(username: string, password: string): Promise<void> {
    const result = await loginApi(username, password)
    accessToken.value = result.access_token
    saveTokens(result.access_token, result.refresh_token)
  }

  /** 拉取用户信息 + 计算菜单权限集合；路由守卫在首次进入时调用 */
  async function loadUserInfo(): Promise<UserInfo> {
    const info = await getUserInfo()
    userInfo.value = info
    if (info.is_superuser) {
      allowedMenuPaths.value = 'all'
    } else {
      allowedMenuPaths.value = await loadRoleMenuPaths(info.roles.map((r) => r.id))
    }
    return info
  }

  async function loadRoleMenuPaths(roleIds: number[]): Promise<Set<string>> {
    const results = await Promise.allSettled(roleIds.map((id) => getRoleAuthorized(id)))
    const paths = new Set<string>()
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const p of normalizeBackendMenuPaths(r.value.menus)) paths.add(p)
      }
      // rejected（如角色未绑定 role/authorized API → 403）：降级跳过，不阻塞登录
    }
    return paths
  }

  function logout(): void {
    accessToken.value = ''
    userInfo.value = null
    allowedMenuPaths.value = new Set<string>()
    clearTokens()
  }

  return {
    accessToken,
    userInfo,
    allowedMenuPaths,
    isLoggedIn,
    isSuperuser,
    displayName,
    login,
    loadUserInfo,
    logout,
  }
})
