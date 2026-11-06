<template>
  <el-menu
    :default-active="activePath"
    router
    background-color="#001529"
    text-color="rgba(255,255,255,0.68)"
    active-text-color="#ffd04b"
    class="side-menu"
  >
    <template v-for="item in menuItems" :key="item.path">
      <el-sub-menu v-if="item.children && item.children.length > 0" :index="item.path">
        <template #title>
          <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </template>
        <el-menu-item
          v-for="child in item.children"
          :key="child.path"
          :index="child.path"
        >
          <el-icon v-if="child.icon"><component :is="child.icon" /></el-icon>
          <span>{{ child.title }}</span>
        </el-menu-item>
      </el-sub-menu>
      <el-menu-item v-else :index="item.path">
        <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
        <span>{{ item.title }}</span>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { routes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { filterMenuRoutes, type MenuMeta } from '@/utils/menu'

interface MenuNode {
  path: string
  title: string
  icon?: string
  children: MenuNode[]
}

/** 拼接父子路径为绝对路径（与 vue-router 解析规则一致的骨架实现） */
function resolvePath(parentPath: string, childPath: string): string {
  if (childPath.startsWith('/')) return childPath
  return `${parentPath}/${childPath}`.replace(/\/+/g, '/')
}

function toMenuNodes(
  parentPath: string,
  children: readonly import('vue-router').RouteRecordRaw[],
): MenuNode[] {
  return children.map((child) => {
    const meta = (child.meta ?? {}) as MenuMeta
    const path = resolvePath(parentPath, child.path)
    return {
      path,
      title: meta.title ?? path,
      icon: meta.icon,
      children: child.children ? toMenuNodes(path, child.children) : [],
    }
  })
}

const route = useRoute()
const auth = useAuthStore()

const activePath = computed(() => route.path)

/**
 * 侧边栏 = 所有 Layout 路由（'/' 与 BE-08 起的 '/content' 等业务目录）children
 * 经 RBAC 过滤后的拼接结果。hidden / 无 children 的顶层路由（login/404）跳过。
 */
const menuItems = computed<MenuNode[]>(() => {
  const nodes: MenuNode[] = []
  for (const layoutRoute of routes) {
    const meta = layoutRoute.meta as { hidden?: boolean } | undefined
    if (meta?.hidden === true) continue
    if (!layoutRoute.children || layoutRoute.children.length === 0) continue
    const allowed = filterMenuRoutes(layoutRoute.children, auth.allowedMenuPaths)
    nodes.push(...toMenuNodes(layoutRoute.path, allowed))
  }
  return nodes
})
</script>

<style scoped>
.side-menu {
  border-right: none;
}
</style>
