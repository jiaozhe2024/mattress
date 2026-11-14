import { defineStore } from "pinia";

interface ProductFilterState {
  /** 首页分类卡 / jump_type=2 banner 请求的分类筛选；产品列表页（tabBar）消费。
   * 产品列表是 tabBar 页，switchTab 无法带参，按核心约定 9 走 Pinia 传参。 */
  requestedCategoryId: number | null;
  /** 首页寝具入口（9B/9D/9P）请求的型号关键词；产品列表页消费并以关键词搜索。
   * 分类与关键词互斥：后写覆盖前写，避免「分类 + 型号」双条件导致空结果。 */
  requestedKeyword: string | null;
}

export const useProductFilterStore = defineStore("productFilter", {
  state: (): ProductFilterState => ({
    requestedCategoryId: null,
    requestedKeyword: null,
  }),
  actions: {
    requestCategory(categoryId: number): void {
      this.requestedCategoryId = categoryId;
      this.requestedKeyword = null;
    },
    requestKeyword(keyword: string): void {
      this.requestedKeyword = keyword;
      this.requestedCategoryId = null;
    },
    clearRequest(): void {
      this.requestedCategoryId = null;
      this.requestedKeyword = null;
    },
  },
});
