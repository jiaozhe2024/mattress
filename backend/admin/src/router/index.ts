import { createRouter, createWebHistory } from 'vue-router'

import { routes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { isRouteAllowed, type MenuMeta } from '@/utils/menu'

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 全局路由守卫：
 * 1. 无 token → 跳登录（带 redirect 回跳参数）
 * 2. 有 token 访问 /login → 回首页
 * 3. 首次进入拉取 userinfo（失败如 token 失效 → 401 由 axios 拦截器清 token 跳登录，
 *    此处捕获后同样回登录页，避免守卫死循环）
 * 4. RBAC：目标路由 meta.rbacPath 不在权限集合内 → 回工作台
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  document.title = to.meta.title
    ? `${String(to.meta.title)} - 床垫选品管理后台`
    : '床垫选品管理后台'

  if (to.path === '/login') {
    return auth.isLoggedIn ? { path: '/' } : true
  }

  if (!auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (auth.userInfo === null) {
    try {
      await auth.loadUserInfo()
    } catch {
      auth.logout()
      return { path: '/login', query: { redirect: to.fullPath } }
    }
  }

  const meta = (to.meta ?? {}) as MenuMeta
  if (!isRouteAllowed(meta, auth.allowedMenuPaths)) {
    return { path: '/dashboard' }
  }
  return true
})

export default router
