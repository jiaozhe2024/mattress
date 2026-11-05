import type { RouteRecordRaw } from 'vue-router'

/**
 * RBAC 菜单级过滤（骨架版）：
 * - 超管（is_superuser=true）放行全部菜单
 * - 普通用户：路由 meta.rbacPath 命中「角色菜单 path 并集」才可见
 * - meta.alwaysAllow=true 的路由（如工作台/404）对所有登录用户可见
 *
 * 后端菜单 path 语义（backend init_menus 种子）：一级菜单为绝对路径（/system），
 * 子菜单为相对片段（user）；比对时对相对片段做父子拼接归一化。
 */

/** 把后端菜单树归一化为绝对路径集合 */
export function normalizeBackendMenuPaths(
  menus: { path: string; parent_id?: number; id?: number }[],
): Set<string> {
  const byId = new Map<number, { path: string; parent_id?: number }>()
  for (const m of menus) {
    if (typeof m.id === 'number') byId.set(m.id, m)
  }
  const paths = new Set<string>()
  for (const m of menus) {
    paths.add(resolveMenuPath(m, byId))
  }
  return paths
}

function resolveMenuPath(
  menu: { path: string; parent_id?: number },
  byId: Map<number, { path: string; parent_id?: number }>,
): string {
  if (menu.path.startsWith('/')) return menu.path
  const parent = menu.parent_id ? byId.get(menu.parent_id) : undefined
  const parentPath = parent ? resolveMenuPath(parent, byId) : ''
  return `${parentPath}/${menu.path}`.replace(/\/+/g, '/')
}

export interface MenuMeta {
  title?: string
  icon?: string
  /** 对应后端菜单 path，用于 RBAC 过滤；缺省等同 alwaysAllow */
  rbacPath?: string
  /** 所有登录用户可见（工作台等） */
  alwaysAllow?: boolean
  /** 不在侧边栏显示（404/详情页等） */
  hidden?: boolean
}

/** 按权限过滤路由树，返回侧边栏可用的菜单路由（不改原数组，返回新树） */
export function filterMenuRoutes(
  routes: readonly RouteRecordRaw[],
  allowedPaths: Set<string> | 'all',
): RouteRecordRaw[] {
  const result: RouteRecordRaw[] = []
  for (const route of routes) {
    const meta = (route.meta ?? {}) as MenuMeta
    if (meta.hidden) continue
    const allowed =
      allowedPaths === 'all' ||
      meta.alwaysAllow === true ||
      (meta.rbacPath !== undefined && allowedPaths.has(meta.rbacPath))
    if (!allowed) continue
    if (route.children && route.children.length > 0) {
      const children = filterMenuRoutes(route.children, allowedPaths)
      // 目录节点：子菜单全被过滤掉则整个目录隐藏
      if (children.length === 0 && !meta.alwaysAllow) continue
      result.push({ ...route, children })
    } else {
      result.push({ ...route })
    }
  }
  return result
}

/** 校验单条路由是否可访问（路由守卫用） */
export function isRouteAllowed(
  meta: MenuMeta,
  allowedPaths: Set<string> | 'all',
): boolean {
  if (meta.alwaysAllow === true || meta.hidden === true) return true
  if (allowedPaths === 'all') return true
  return meta.rbacPath !== undefined && allowedPaths.has(meta.rbacPath)
}
