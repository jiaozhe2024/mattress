/**
 * 底部导航数据模型（Q1 决议：three / two 两套结构共用一份配置）
 *
 * 独立成 .ts 便于 TabBar.vue、原生 custom-tab-bar 入口与单测共用同一份真值。
 */

export interface TabBarItem {
  key: string;
  label: string;
  icon: string;
  /** tabBar 页路径；「返回」项无路径。 */
  path?: string;
}

export type TabBarVariant = "three" | "two";

export const TAB_BAR_THREE: readonly TabBarItem[] = [
  { key: "home", label: "首页", icon: "home", path: "/pages/index/index" },
  { key: "product", label: "产品", icon: "grid", path: "/pages/product/category" },
  { key: "user", label: "我的", icon: "user", path: "/pages/user/index" },
];

export const TAB_BAR_TWO: readonly TabBarItem[] = [
  { key: "home", label: "首页", icon: "home", path: "/pages/index/index" },
  { key: "back", label: "返回", icon: "undo-2" },
];

/** 依 variant 返回项配置。 */
export function tabBarItemsOf(variant: TabBarVariant): readonly TabBarItem[] {
  return variant === "two" ? TAB_BAR_TWO : TAB_BAR_THREE;
}

/**
 * 解析选中下标：显式 active 优先；three 默认首页（0）；two 默认无选中（-1）。
 */
export function tabBarActiveIndexOf(
  variant: TabBarVariant,
  active?: number
): number {
  if (typeof active === "number" && active >= 0) {
    return active < tabBarItemsOf(variant).length ? active : -1;
  }
  return variant === "three" ? 0 : -1;
}
