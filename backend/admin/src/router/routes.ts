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
    // BE-08 内容管理目录：meta.rbacPath 与后端 init_content_menus 种子对齐
    // （catalog path='/content'，子菜单为相对片段，归一化后 /content/<path>）
    path: '/content',
    component: Layout,
    redirect: '/content/banner',
    meta: { title: '内容管理', icon: 'Files', rbacPath: '/content' },
    children: [
      {
        path: 'banner',
        name: 'ContentBanner',
        component: () => import('@/views/banner/index.vue'),
        meta: { title: '轮播图管理', icon: 'Picture', rbacPath: '/content/banner' },
      },
      {
        path: 'category',
        name: 'ContentCategory',
        component: () => import('@/views/category/index.vue'),
        meta: { title: '产品分类管理', icon: 'Menu', rbacPath: '/content/category' },
      },
      {
        path: 'product',
        name: 'ContentProduct',
        component: () => import('@/views/product/index.vue'),
        meta: { title: '产品管理', icon: 'Goods', rbacPath: '/content/product' },
      },
      {
        path: 'article',
        name: 'ContentArticle',
        component: () => import('@/views/article/index.vue'),
        meta: { title: '资讯与服务管理', icon: 'Document', rbacPath: '/content/article' },
      },
      {
        path: 'brand',
        name: 'ContentBrand',
        component: () => import('@/views/brand/index.vue'),
        meta: { title: '品牌信息配置', icon: 'Flag', rbacPath: '/content/brand' },
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
