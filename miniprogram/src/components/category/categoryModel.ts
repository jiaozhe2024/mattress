/**
 * 产品分类列表页（MP-03A）静态内容与纯展示逻辑
 *
 * 真值来源：docs/design/references/product-category.png + design-spec/spec.md §5.2 +
 * open-questions.md Q12（跳过版本条）/ Q15（8 分类 + banner_image 优先）。
 * 抽出纯函数便于 vitest 覆盖：分类入口排序与双通道降级。
 */
import type { WxCategory } from "@/types/home";

/** 系列横幅文案与展示图（spec.md §5.2 ①）。 */
export const CATEGORY_BANNER = {
  brand: "LEKASI 乐卡思",
  title: "9M 特制床垫",
  subtitle: "让每一次休息，都更舒适",
  /** 9M 床垫展示图：从 references/product-category.png 提取（343×120 设计图区）。 */
  image: "/static/category/banner-mattress.png",
} as const;

/**
 * 分类入口右侧箭头颜色 = $color-navy-50（tokens.scss / design-tokens.md）。
 * Icon.vue 的颜色进 SVG data URI，无法用 CSS 变量，故在此以常量镜像 token。
 */
export const CATEGORY_CHEVRON_COLOR = "#8890b8";

/** 分类入口视图：banner_image 可用时为整块图片，否则降级为标题 + 副文案。 */
export interface CategoryEntryView {
  id: number;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

/**
 * 生成分类入口视图（Q15 双通道）。
 * 按 sort 升序（服务端已排序，此处防御性再排一次）；图片加载失败时由页面
 * 把 id 加入 failedIds，自动降级为文字，避免白块。
 */
export function categoryEntryViewsOf(
  categories: readonly WxCategory[],
  failedIds: readonly number[] = []
): CategoryEntryView[] {
  return [...categories]
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((category) => {
      const banner = (category.banner_image ?? "").trim();
      const useImage = banner !== "" && !failedIds.includes(category.id);
      return {
        id: category.id,
        title: category.name,
        subtitle: (category.subtitle ?? "").trim(),
        imageSrc: useImage ? banner : null,
      };
    });
}

/** 点击分类 → 产品列表页带分类条件（普通页，可带参导航）。 */
export function productListUrlOf(categoryId: number): string {
  return `/pages/product/list?category_id=${categoryId}`;
}
