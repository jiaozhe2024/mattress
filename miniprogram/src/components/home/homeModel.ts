/**
 * 首页（MP-02）静态内容与纯展示逻辑
 *
 * 真值来源：docs/design/design-spec/spec.md §5.1 + docs/design/open-questions.md Q14/Q15。
 * 抽出纯函数便于 vitest 覆盖：系列卡取前 4、双通道渲染（图片优先/文字降级）、
 * 轮播指示点数量（仅 1 张时隐藏）。
 */
import type { WxCategory } from "@/types/home";

/** 品牌主视觉文案（spec.md §5.1 ①）。 */
export const HOME_HERO = {
  brand: "LEKASI 乐卡思",
  titleLines: ["把舒适，", "带回每一个夜晚"],
  subtitle: "探索适合自己与家人的好眠选择",
} as const;

/** 2×2 系列卡最多展示条数（sort 1-4）。 */
export const SERIES_CARD_LIMIT = 4;

export interface BeddingEntry {
  /** 型号（产品页关键词搜索用）。 */
  model: string;
  name: string;
}

/** 3 个寝具入口（非分类；Q15 决议：点击按型号搜索）。 */
export const BEDDING_ENTRIES: readonly BeddingEntry[] = [
  { model: "9B", name: "特制软床" },
  { model: "9D", name: "抗菌软床" },
  { model: "9P", name: "助眠枕头" },
];

/** 好眠服务区块标题（spec.md §5.1 ③）。 */
export const HOME_SERVICE_TITLE = "乐卡思 · 好眠服务";

export interface HomeServiceCard {
  key: string;
  title: string;
  caption: string;
  /** 服务图 URL；asset-inventory「首页服务图 ×3」真实素材待补，空字符串走占位层。 */
  image: string;
}

export const HOME_SERVICE_CARDS: readonly HomeServiceCard[] = [
  { key: "product", title: "产品认识", caption: "了解面料与结构", image: "" },
  { key: "sleep", title: "睡眠小课堂", caption: "找到适合的睡感", image: "" },
  { key: "store", title: "到店体验", caption: "亲自感受舒适", image: "" },
];

export type QuickEntryKey = "news" | "contact";

export interface QuickEntry {
  key: QuickEntryKey;
  label: string;
  icon: "newspaper" | "message-circle";
}

/** 资讯与客服快捷入口（spec.md §5.1 ④）。 */
export const QUICK_ENTRIES: readonly QuickEntry[] = [
  { key: "news", label: "乐卡思资讯", icon: "newspaper" },
  { key: "contact", label: "联系客服", icon: "message-circle" },
];

/** 系列卡视图：banner_image 可用时返回图片路径，否则为 null（渲染文字降级）。 */
export interface SeriesCardView {
  id: number;
  title: string;
  subtitle: string;
  imageSrc: string | null;
}

/** 按 sort 升序取前 limit 条分类（服务端已排序，此处防御性再排一次）。 */
export function seriesCardsOf(
  categories: readonly WxCategory[],
  limit: number = SERIES_CARD_LIMIT
): WxCategory[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return [...categories]
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .slice(0, safeLimit);
}

/**
 * 生成系列卡视图（Q15 双通道：banner_image 非空且未加载失败 → 图片；否则 name + subtitle）。
 * 图片加载失败时由页面把它加入 failedIds，这里自动降级为文字，避免白块。
 */
export function seriesCardViewsOf(
  categories: readonly WxCategory[],
  failedIds: readonly number[] = [],
  limit: number = SERIES_CARD_LIMIT
): SeriesCardView[] {
  return seriesCardsOf(categories, limit).map((category) => {
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

/** 轮播指示点数量：仅 1 张（或 0 张）时隐藏，其余随 banners.length 动态。 */
export function bannerIndicatorCount(count: number): number {
  return Number.isFinite(count) && count > 1 ? Math.floor(count) : 0;
}
