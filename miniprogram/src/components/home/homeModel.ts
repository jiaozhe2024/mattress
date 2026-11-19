/**
 * 首页（MP-02）静态内容与纯展示逻辑
 *
 * 真值来源：docs/design/design-spec/spec.md §5.1 + docs/design/open-questions.md Q14/Q15。
 * 抽出纯函数便于 vitest 覆盖：系列卡取前 4、双通道渲染（图片优先/文字降级）、
 * 好眠服务卡取前 3（数据源 /wxapi/home services）、轮播指示点数量（仅 1 张时隐藏）。
 */
import type { WxArticleSummary, WxCategory } from "@/types/home";

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

/** 首页好眠服务卡最多展示条数（与 design 稿一致）。 */
export const HOME_SERVICE_LIMIT = 3;

/** 服务卡视图：cover 可用时返回图片路径，否则为 null（渲染占位层）。 */
export interface ServiceCardView {
  id: number;
  title: string;
  imageSrc: string | null;
}

/**
 * 生成服务卡视图（数据源：GET /wxapi/home 的 services，即 category=service 的已发布文章）。
 * 后端按 id 升序返回，此处取前 limit 条；卡片只渲染标题。
 */
export function serviceCardViewsOf(
  services: readonly WxArticleSummary[],
  failedIds: readonly number[] = [],
  limit: number = HOME_SERVICE_LIMIT
): ServiceCardView[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  return services.slice(0, safeLimit).map((service) => {
    const cover = (service.cover ?? "").trim();
    const useImage = cover !== "" && !failedIds.includes(service.id);
    return {
      id: service.id,
      title: service.title,
      imageSrc: useImage ? cover : null,
    };
  });
}

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
