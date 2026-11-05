import { defineStore } from "pinia";

interface ProductFilterState {
  /** 首页分类宫格 / jump_type=2 banner 请求的分类筛选；产品列表页（MP-03）消费。
   * 产品列表是 tabBar 页，switchTab 无法带参，按核心约定 9 走 Pinia 传参。 */
  requestedCategoryId: number | null;
}

export const useProductFilterStore = defineStore("productFilter", {
  state: (): ProductFilterState => ({
    requestedCategoryId: null,
  }),
  actions: {
    requestCategory(categoryId: number): void {
      this.requestedCategoryId = categoryId;
    },
    clearRequest(): void {
      this.requestedCategoryId = null;
    },
  },
});
