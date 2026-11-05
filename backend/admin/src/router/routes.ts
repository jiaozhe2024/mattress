import type { RouteRecordRaw } from 'vue-router'

import Layout from '@/layout/index.vue'

/**
 * 静态路由表（骨架版）。
 * BE-08/BE-09 业务页在此追加 Layout children，并声明 meta.rbacPath
 * 与后端菜单表 path 对齐，即可获得菜单级 RBAC 过滤。
 */
export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', hidden: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'HomeFilled', alwaysAllow: true },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', hidden: true, alwaysAllow: true },
  },
]
