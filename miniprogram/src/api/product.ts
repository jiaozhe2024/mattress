import { get } from "@/utils/request";
import type { Product, WxProductListItem, WxProductPage } from "@/types/product";
import type { WxCategory } from "@/types/home";
import type { WxProductDetail } from "@/components/product/productDetailModel";

/** 后端 BE-05 支持的排序值（schemas/wx_content.py ProductSort）。 */
export type BackendProductSort = "comprehensive" | "newest";

/** 产品列表排序 Tab（V3 product-list.png 设计：综合/推荐/新品）。 */
export type ProductSortTab = "comprehensive" | "recommended" | "newest";

/**
 * Tab → 后端 sort 映射。BE-05 仅 comprehensive/newest，无独立推荐排序：
 * 「推荐」回退 comprehensive（运营在后台维护的 sort  curated 顺序即推荐序）。
 * 后端补推荐排序时只改本表。
 */
export const SORT_TABS: ReadonlyArray<{
  key: ProductSortTab;
  label: string;
  backendSort: BackendProductSort;
}> = [
  { key: "comprehensive", label: "综合", backendSort: "comprehensive" },
  { key: "recommended", label: "推荐", backendSort: "comprehensive" },
  { key: "newest", label: "新品", backendSort: "newest" },
];

export function backendSortOf(tab: ProductSortTab): BackendProductSort {
  const found = SORT_TABS.find((item) => item.key === tab);
  return found ? found.backendSort : "comprehensive";
}

export interface ProductQuery {
  page?: number;
  size?: number;
  category_id?: number;
  keyword?: string;
  sort?: BackendProductSort;
}

/** 产品列表（仅上架；silent：错误由页面内联态展示，不重复 toast）。 */
export function getProducts(query: ProductQuery = {}): Promise<WxProductPage> {
  return get<WxProductPage>(
    "/wxapi/products",
    { page: 1, size: 10, sort: "comprehensive", ...query },
    { silent: true }
  );
}

/** 启用分类列表（侧边导航数据源）。 */
export function getCategories(): Promise<WxCategory[]> {
  return get<WxCategory[]>("/wxapi/categories", undefined, { silent: true });
}

/**
 * 产品详情（仅上架；下架/不存在后端返回 404）。silent：错误由页面统一渲染
 * 错误态（Q8 缺失态），不叠加统一 toast。
 */
export function getProductDetail(id: number): Promise<WxProductDetail> {
  return get<WxProductDetail>(`/wxapi/products/${id}`, undefined, {
    silent: true,
  });
}

/** 列表项 → 选品 store 的 Product（store 契约不含分类字段，显式映射避免多余字段扩散）。 */
export function toSelectionProduct(item: WxProductListItem): Product {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
    main_image: item.main_image,
    ...(item.slogan !== null ? { slogan: item.slogan } : null),
    ...(item.spec !== null ? { spec: item.spec } : null),
    ...(item.sleep_feel !== null ? { sleep_feel: item.sleep_feel } : null),
  };
}
