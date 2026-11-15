/**
 * 产品详情页（MP-04，V3 二级页）静态文案与纯展示逻辑
 *
 * 真值来源：docs/design/references/product-detail.png + design-spec/spec.md §5.4 +
 * open-questions.md Q8（缺失态不做插图）/ Q12（跳过版本条）/ Q13（热区先行）。
 *
 * 数据契约：backend/src/schemas/wx_content.py WxProductDetailOut（BE-05）。
 * detail_images / real_images 后端为 JSON 数组（list[Any]），此处收敛为 string[]，
 * 过滤非字符串与空串，避免脏数据流入 <image src>。
 */
import type { WxProductListItem } from "@/types/product";

/** GET /wxapi/products/{id} 详情载荷（继承列表项字段）。 */
export interface WxProductDetail extends WxProductListItem {
  detail_images: unknown[] | null;
  real_images: unknown[] | null;
  detail_content: string | null;
  create_time: string | null;
}

/** 详情页导航标题（spec.md §5.4，逐字固定）。 */
export const DETAIL_NAV_TITLE = "LEKASI 乐卡思";

/** 信息条规格行前后缀（spec.md §5.4 ①）。 */
export const SPEC_LINE_PREFIX = "规格：";
export const SPEC_LINE_SUFFIX = " · 实际配置以产品说明为准";

/** 产品说明免责文案（spec.md §5.4 ⑤）。 */
export const DETAIL_DISCLAIMER = "尺寸、厚度与具体材质请以产品实物及说明为准。";

/** 型号行前缀（spec.md §5.4 ③）。 */
export const MODEL_LINE_PREFIX = "型号：";

/** 操作组文案（spec.md §5.4 ③）。 */
export const SHARE_LABEL = "分享";
export const QR_LABEL = "小程序码";
export const SELECT_LABEL = "选款";

/** 加入选品成功提示（tasks.json MP-04 ⑦）。 */
export const SELECTED_TOAST = "已加入选品";

/** 详情/实拍图 Tab（spec.md §5.4 ⑤）。 */
export type DetailTabKey = "detail" | "real";

export const DETAIL_TABS: ReadonlyArray<{ key: DetailTabKey; label: string }> = [
  { key: "detail", label: "产品详情" },
  { key: "real", label: "实拍图" },
];

/** 缺 id / 下架 / 不存在统一错误文案（Q8：不做插图，仅文案 + 返回）。 */
export const DETAIL_ERROR_TEXT = "产品不存在或已下架";

/** 富文本为空时的兜底（Q8：仅文案，不做插图）。 */
export const EMPTY_DETAIL_TEXT = "暂无产品详情";
export const EMPTY_REAL_TEXT = "暂无实拍图";

/** onLoad query 的 id 解析：仅接受正整数，其余返回 null。 */
export function parseProductId(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** 后端 JSON 数组 → 图片 URL 列表（只保留非空字符串）。 */
export function imageListOf(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is string => typeof item === "string" && item.trim() !== ""
  );
}

/**
 * 海报图集：优先 detail_images（分页点数量随其长度），为空时回退主图。
 * 仅 1 张时页面隐藏分页点。
 */
export function posterImagesOf(product: WxProductDetail): string[] {
  const detailImages = imageListOf(product.detail_images);
  if (detailImages.length > 0) return detailImages;
  return typeof product.main_image === "string" && product.main_image !== ""
    ? [product.main_image]
    : [];
}

/** 产品详情 Tab 的细节图（取图集首张，按设计稿单图 180 高）。 */
export function detailImageOf(product: WxProductDetail): string {
  return posterImagesOf(product)[0] ?? "";
}

/** 实拍图列表。 */
export function realImagesOf(product: WxProductDetail): string[] {
  return imageListOf(product.real_images);
}

/** 信息条 feature 行（取睡感标签；为空不渲染该行）。 */
export function featureLineOf(product: WxProductDetail): string {
  return (product.sleep_feel ?? "").trim();
}

/** 信息条规格行：`规格：{spec} · 实际配置以产品说明为准`（spec 缺失用「—」占位）。 */
export function specLineOf(product: WxProductDetail): string {
  const spec = (product.spec ?? "").trim();
  return `${SPEC_LINE_PREFIX}${spec === "" ? "—" : spec}${SPEC_LINE_SUFFIX}`;
}

/** 产品名（海报主标题 / 基本信息标题 / 详情小标题共用）。 */
export function productNameOf(product: WxProductDetail): string {
  return product.name.trim();
}

/** 型号行：`型号：{model}`（model 缺失用「—」占位）。 */
export function modelLineOf(product: WxProductDetail): string {
  const model = (product.model ?? "").trim();
  return `${MODEL_LINE_PREFIX}${model === "" ? "—" : model}`;
}

/** 分享卡片载荷：标题=产品名，路径带 id，封面用主图绝对地址。 */
export function shareMessageOf(product: WxProductDetail): {
  title: string;
  path: string;
  imageUrl?: string;
} {
  const message: { title: string; path: string; imageUrl?: string } = {
    title: product.name,
    path: `/pages/product/detail?id=${product.id}`,
  };
  if (typeof product.main_image === "string" && product.main_image !== "") {
    message.imageUrl = product.main_image;
  }
  return message;
}
