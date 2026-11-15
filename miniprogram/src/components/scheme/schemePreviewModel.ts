/**
 * 预览分享页（MP-05D）静态内容与纯展示逻辑
 *
 * 真值来源：docs/design/references/plan-05-preview-share.png +
 * design-spec/spec.md §5.9 + open-questions.md Q12（跳过版本条）。
 *
 * 抽出纯函数便于 vitest 覆盖：快照 → 海报视图映射、标题/卖点/规格文案、
 * 访客态判定、分享路径构造。
 */
import type { WxSchemeProduct } from "@/api/scheme";

/** 导航标题（spec §5.9）。 */
export const PREVIEW_NAV_TITLE = "LEKASI 乐卡思";

/** 品牌行（海报内，Inter Bold 10 navy 字距 1）。 */
export const PREVIEW_BRAND = "LEKASI 乐卡思";

/** 海报内固定产品信息条文案（spec §5.9 ②「产品信息」）。 */
export const PREVIEW_FEATURE_TEXT = "细腻面料　｜　分层支撑　｜　简洁设计";

/** 产品底注（spec §5.9 ②）。 */
export const PREVIEW_FOOTNOTE = "LEKASI 乐卡思 · 产品推荐";

/** 底部按钮（spec §5.9 ③）。 */
export const PREVIEW_BACK_LABEL = "返回";
export const PREVIEW_SHARE_LABEL = "立即分享";

/** 规格行前缀（spec §5.9 ②）。 */
export const PREVIEW_SPEC_PREFIX = "规格：";
export const PREVIEW_SPEC_SUFFIX = " · 实际配置以产品说明为准";

/** 加载/错误/空态文案。 */
export const PREVIEW_LOADING_TEXT = "加载中…";
export const PREVIEW_ERROR_TEXT = "方案加载失败或已删除";
export const PREVIEW_EMPTY_TEXT = "该方案暂无产品";
export const PREVIEW_SHARE_FAILED_TOAST = "分享失败，请稍后再试";

/** 海报视图：从 product_snapshot 映射（核心约定 10：一律读快照，不回查实时产品）。 */
export interface PreviewProductView {
  /** 快照内产品 id（列表 key 用，缺省时退化为序号）。 */
  key: string;
  name: string;
  /** 卖点（快照 slogan）。 */
  sellingPoint: string;
  /** 主图相对路径（页面负责 absoluteUrl）。 */
  mainImage: string;
  /** 规格行完整文案。 */
  specLine: string;
}

function textOf(snapshot: Record<string, unknown>, key: string): string {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

/**
 * 快照数组 → 海报视图数组。
 *
 * 按 sort 升序（后端已排序，此处防御性再排一次）；
 * 快照缺 id 时用 `snapshot-{index}` 兜底，保证列表 key 唯一。
 */
export function previewViewsOf(
  products: readonly WxSchemeProduct[]
): PreviewProductView[] {
  return [...products]
    .sort((a, b) => a.sort - b.sort)
    .map((row, index) => {
      const snapshot = row.snapshot ?? {};
      const rawId = snapshot.id;
      const spec = textOf(snapshot, "spec");
      return {
        key:
          typeof rawId === "number" && Number.isFinite(rawId)
            ? String(rawId)
            : `snapshot-${index}`,
        name: textOf(snapshot, "name"),
        sellingPoint: textOf(snapshot, "slogan"),
        mainImage: textOf(snapshot, "main_image"),
        specLine:
          spec === ""
            ? ""
            : `${PREVIEW_SPEC_PREFIX}${spec}${PREVIEW_SPEC_SUFFIX}`,
      };
    });
}

/**
 * 分享路径：`/pages/scheme/preview?id={id}`。
 *
 * 微信好友打开分享卡片时走 public 接口（免登录），因此不携带 token 等敏感信息。
 */
export function previewSharePathOf(id: number): string {
  return `/pages/scheme/preview?id=${id}`;
}

/** 分享卡片标题（微信会截断过长标题，控制在 30 字内）。 */
export function previewShareTitleOf(title: string): string {
  const trimmed = title.trim();
  if (trimmed === "") return PREVIEW_FOOTNOTE;
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
}
