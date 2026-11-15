/**
 * 我的页（MP-06）静态内容与纯展示逻辑
 *
 * 真值来源：docs/design/references/mine.png + design-spec/spec.md §5.10 +
 * open-questions.md Q2（照稿不加「我的方案」入口）/ Q7（品牌介绍页无画板，
 * 点击 toast）/ Q12（跳过版本条）。
 *
 * 抽出纯函数便于 vitest 覆盖：品牌文案兜底、客服三项、拨号与客服入口构造。
 */
import type { WxBrandInfo } from "@/types/home";

/** 导航标题（一级页，左侧 LEKASI 品牌缩写）。 */
export const MINE_NAV_TITLE = "LEKASI 乐卡思";

/** 品牌行文案（Inter Bold 15 yellow 字距 2）。 */
export const MINE_BRAND = "LEKASI 乐卡思";

/** 品牌主标语（Medium 31 textInv）。 */
export const MINE_SLOGAN = "遇见舒适好眠";

/** 三行品牌理念（Regular 12 textInv 行高 1.45）。 */
export const MINE_INTRO_LINES: readonly string[] = [
  "从一张床垫开始，认真对待每一次休息。",
  "在这里了解产品、挑选睡感，",
  "也把喜欢的选择分享给朋友与家人。",
];

/** 空间图图注（Regular 10 navy50 居中）。 */
export const MINE_SPACE_CAPTION = "家居展示空间示意";

/** 品牌联系入口文案。 */
export const MINE_LEARN_LABEL = "了解乐卡思";
export const MINE_CONTACT_LINE = "产品咨询 · 体验交流 · 合作联系";

/** 客服区块。 */
export const MINE_SERVICE_TITLE = "乐卡思客服";
export const MINE_SERVICE_LEARN = "了解更多";
/** message-circle 图标色（设计稿实测 #f7c400 = color/yellow）。 */
export const MINE_SERVICE_ICON_COLOR = "#f7c400";

/** 客服三项（spec §5.10 客服内容表）。 */
export interface ServiceItem {
  key: string;
  title: string;
  caption: string;
}

export const MINE_SERVICE_ITEMS: readonly ServiceItem[] = [
  { key: "product", title: "产品咨询", caption: MINE_SERVICE_LEARN },
  { key: "feel", title: "睡感选择", caption: MINE_SERVICE_LEARN },
  { key: "usage", title: "使用建议", caption: MINE_SERVICE_LEARN },
];

/** Q7：品牌介绍页无画板，点击给 toast。 */
export const MINE_LEARN_PENDING_TOAST = "品牌介绍页建设中";
/** 客服不可用时的兜底提示。 */
export const MINE_SERVICE_FAIL_TOAST = "客服暂不可用，请稍后再试";

/**
 * 品牌理念文案：优先用后台配置的 intro，为空则回落稿内三行。
 *
 * 注意：后台 intro 是一段长文本，这里只在“完全为空”时兜底 —— 不做换行拆分，
 * 因为运营可能写一整段，强行按句号拆行会破坏语义。
 */
export function introLinesOf(brand: WxBrandInfo | null): readonly string[] {
  const intro = (brand?.intro ?? "").trim();
  if (intro === "") return MINE_INTRO_LINES;
  return [intro];
}

/** 空间图：取门店图第一张（无则空串，页面走占位层）。 */
export function spaceImageOf(brand: WxBrandInfo | null): string {
  const images = brand?.store_images ?? [];
  for (const image of images) {
    const value = (image ?? "").trim();
    if (value !== "") return value;
  }
  return "";
}

/**
 * 合作联系拨号号码：取后台配置的加盟电话。
 *
 * 返回空串表示未配置，调用方应 toast 提示而非弹出空拨号盘。
 */
export function joinPhoneOf(brand: WxBrandInfo | null): string {
  return (brand?.join_phone ?? "").trim();
}

/** 客服入口的合法跳转判定（用于决定是否走 wx.openCustomerServiceChat）。 */
export function hasCustomerServiceConfig(config: {
  corpId: string;
  kfUrl: string;
}): boolean {
  const corpId = (config.corpId ?? "").trim();
  const kfUrl = (config.kfUrl ?? "").trim();
  // 占位值（placeholder）视为未配置，直接 toast 兜底，避免调用必然失败的开放能力
  if (corpId === "" || kfUrl === "") return false;
  if (/placeholder/i.test(corpId) || /placeholder/i.test(kfUrl)) return false;
  return true;
}
