/**
 * 选品页（MP-05A，V3 二级页 §5.6）静态文案与纯函数
 *
 * 真值来源：docs/design/references/plan-02-picker.png + design-spec/spec.md §5.6 +
 * open-questions.md Q8（空结果不做插图）/ Q10（右栏自适应，禁止硬编码 126.92px）/
 * Q11（字号取整 10/8/8）/ Q12（不实现版本条）。
 *
 * 抽出纯函数便于 vitest 覆盖：已选文案、规格行、选中判定、缩略图集合。
 */
import type { Product, WxProductListItem } from "@/types/product";

/** 导航标题（spec.md §5.6，逐字固定）。 */
export const SELECTION_NAV_TITLE = "LEKASI 乐卡思";

/** 搜索占位文案（spec.md §5.6 ①，逐字固定）。 */
export const SELECTION_SEARCH_PLACEHOLDER = "输入型号搜索";

/** 已选栏计数前缀（spec.md §5.6 ③：`已选：N`，全角冒号）。 */
export const SELECTED_COUNT_PREFIX = "已选：";

/** OK 按钮文案（spec.md §5.6 ③）。 */
export const OK_LABEL = "OK";

/** 产品卡「查看详情」标签文案（spec.md §5.6 ②）。 */
export const DETAIL_LABEL = "查看详情";

/** 方案编辑页未落地（MP-05B 之前）时的 toast 文案。 */
export const SCHEME_EDIT_PENDING_TOAST = "方案编辑页建设中";

/** 已选栏计数文案：`已选：N`。 */
export function selectedCountText(count: number): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${SELECTED_COUNT_PREFIX}${safe}`;
}

/**
 * 产品卡规格行：优先 spec 字段（`1800 × 2000 mm`）。
 * 列表项与 store 的 Product 都可能缺省，统一回退空串（不渲染该行）。
 */
export function specTextOf(product: WxProductListItem | Product): string {
  const raw = product.spec ?? "";
  return raw.trim();
}

/** 已选判定：以 store 的 selectedProducts 为唯一真值（核心约定 9）。 */
export function isProductSelected(
  selectedProducts: readonly Product[],
  productId: number
): boolean {
  return selectedProducts.some((product) => product.id === productId);
}

/**
 * 已选栏缩略图集合：完整保留已选列表（区宽 150 内横向滚动，保证每一个都可移除）。
 * 返回只读视图，避免页面层意外改写 store 状态。
 */
export function thumbnailsOf(selectedProducts: readonly Product[]): readonly Product[] {
  return selectedProducts;
}
