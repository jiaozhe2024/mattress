/**
 * 产品页（MP-03B，V3 二级页）静态文案与纯展示逻辑
 *
 * 真值来源：docs/design/references/product-list.png + design-spec/spec.md §5.3 +
 * open-questions.md Q5（排序规则延后）/ Q6（视图切换延后）/ Q12（跳过版本条）。
 * 抽出纯函数便于 vitest 覆盖：导航标题解析、详情页跳转 URL、睡感标签提取。
 */
import type { WxCategory } from "@/types/home";
import type { WxProductListItem } from "@/types/product";

/** 搜索占位文案（spec.md §5.3 ①，逐字固定）。 */
export const SEARCH_PLACEHOLDER = "请输入搜索的商品";

/** 分类名解析失败时的兜底标题（spec.md §5.3 导航标题为分类名）。 */
export const DEFAULT_PAGE_TITLE = "产品";

/** 产品卡「查看详情」标签文案（spec.md §5.3 ②）。 */
export const CARD_DETAIL_LABEL = "查看详情";

/** 产品详情页未落地（MP-04 之前）时的 toast 文案。 */
export const DETAIL_PENDING_TOAST = "产品详情页建设中";

/**
 * 解析二级页导航标题：category_id 命中分类表时用分类名；
 * 否则回退 query 直传的 category_name；都没有则「产品」。
 * 空字符串按「未提供」处理（小程序 query 常见 `?category_name=`）。
 */
export function resolvePageTitle(
  categoryId: number | null,
  categories: readonly WxCategory[],
  queryName?: string | null
): string {
  if (categoryId !== null) {
    const matched = categories.find((category) => category.id === categoryId);
    if (matched) return matched.name;
  }
  const trimmedName = (queryName ?? "").trim();
  if (trimmedName !== "") return trimmedName;
  return DEFAULT_PAGE_TITLE;
}

/** onLoad query 的 category_id 解析：仅接受正整数，其余返回 null。 */
export function parseCategoryId(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** 产品详情页 URL（MP-04 未落地时由页面 navigateTo fail 回退 toast，不留死链）。 */
export function productDetailUrlOf(productId: number): string {
  return `/pages/product/detail?id=${productId}`;
}

/**
 * 产品卡睡感标签文本：取 sleep_feel 首个分词；为空返回空串（不渲染标签，
 * 不臆造数据）。BE-10 seed 均为「舒适睡感」，故正常情况下即稿件文案。
 */
export function sleepFeelTagOf(product: WxProductListItem): string {
  const raw = (product.sleep_feel ?? "").trim();
  if (raw === "") return "";
  const first = raw
    .split(/[、,，/|\s]+/)
    .map((tag) => tag.trim())
    .find(Boolean);
  return first ?? "";
}
