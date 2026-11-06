import { computed, ref } from "vue";
import {
  backendSortOf,
  getProducts,
  type ProductSortTab,
} from "@/api/product";
import type { WxProductListItem } from "@/types/product";

export type ProductListStatus = "loading" | "ready" | "error";

/** 单页 10 条：宫格 2 列 = 5 行，兼顾首屏体验与请求次数（后端上限 50）。 */
export const PRODUCT_PAGE_SIZE = 10;

/**
 * 产品列表页数据逻辑（MP-03）：分类/关键词/排序筛选 + 分页加载。
 * 竞态防护：快速切换筛选时仅接受最后一次请求的响应（requestSeq）。
 */
export function useProductList() {
  const items = ref<WxProductListItem[]>([]);
  const total = ref(0);
  const page = ref(1);
  const status = ref<ProductListStatus>("loading");
  const loadingMore = ref(false);
  const loadMoreFailed = ref(false);
  const categoryId = ref<number | null>(null);
  const keyword = ref("");
  const sortTab = ref<ProductSortTab>("comprehensive");

  let requestSeq = 0;

  const hasMore = computed((): boolean => items.value.length < total.value);
  const isEmpty = computed(
    (): boolean => status.value === "ready" && items.value.length === 0
  );

  async function fetchPage(targetPage: number): Promise<void> {
    const seq = ++requestSeq;
    if (targetPage === 1) {
      status.value = "loading";
    } else {
      loadingMore.value = true;
    }
    loadMoreFailed.value = false;
    try {
      const data = await getProducts({
        page: targetPage,
        size: PRODUCT_PAGE_SIZE,
        sort: backendSortOf(sortTab.value),
        ...(categoryId.value !== null ? { category_id: categoryId.value } : null),
        ...(keyword.value !== "" ? { keyword: keyword.value } : null),
      });
      if (seq !== requestSeq) return;
      page.value = targetPage;
      total.value = data.total;
      items.value =
        targetPage === 1 ? [...data.items] : [...items.value, ...data.items];
      status.value = "ready";
    } catch {
      if (seq !== requestSeq) return;
      if (targetPage === 1) {
        items.value = [];
        total.value = 0;
        page.value = 1;
        status.value = "error";
      } else {
        loadMoreFailed.value = true;
      }
    } finally {
      if (seq === requestSeq) loadingMore.value = false;
    }
  }

  function reload(): Promise<void> {
    return fetchPage(1);
  }

  function loadMore(): Promise<void> {
    if (status.value !== "ready" || loadingMore.value || !hasMore.value) {
      return Promise.resolve();
    }
    return fetchPage(page.value + 1);
  }

  function setCategory(nextCategoryId: number | null): Promise<void> {
    if (categoryId.value === nextCategoryId) return Promise.resolve();
    categoryId.value = nextCategoryId;
    return reload();
  }

  function setSortTab(tab: ProductSortTab): Promise<void> {
    if (sortTab.value === tab) return Promise.resolve();
    sortTab.value = tab;
    return reload();
  }

  /** 提交关键词（页面层负责 300ms 防抖）；同词不重复请求。 */
  function search(nextKeyword: string): Promise<void> {
    const trimmed = nextKeyword.trim();
    if (keyword.value === trimmed && status.value !== "error") {
      return Promise.resolve();
    }
    keyword.value = trimmed;
    return reload();
  }

  return {
    items,
    total,
    status,
    loadingMore,
    loadMoreFailed,
    categoryId,
    keyword,
    sortTab,
    hasMore,
    isEmpty,
    reload,
    loadMore,
    setCategory,
    setSortTab,
    search,
  };
}
