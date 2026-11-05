import type { WxBanner } from "@/types/home";

/** Banner 点击分发结果（aaa.md §3.2.2：jump_type 1 无 2 分类 3 产品 4 外链）。 */
export type JumpTarget =
  | { kind: "none" }
  | { kind: "category"; categoryId: number }
  | { kind: "product"; productId: number }
  | { kind: "external"; url: string }
  | { kind: "invalid"; reason: string };

const EXTERNAL_URL_PATTERN = /^https?:\/\/.+/i;

function parsePositiveInt(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) return null;
  return value;
}

/** 纯函数：把 banner 的 jump_type/jump_value 解析为跳转目标，非法值一律 invalid（不抛错）。 */
export function resolveBannerTarget(banner: WxBanner): JumpTarget {
  switch (banner.jump_type) {
    case 1:
      return { kind: "none" };
    case 2: {
      const categoryId = parsePositiveInt(banner.jump_value);
      return categoryId === null
        ? { kind: "invalid", reason: "banner 分类跳转值非法" }
        : { kind: "category", categoryId };
    }
    case 3: {
      const productId = parsePositiveInt(banner.jump_value);
      return productId === null
        ? { kind: "invalid", reason: "banner 产品跳转值非法" }
        : { kind: "product", productId };
    }
    case 4: {
      const url = (banner.jump_value ?? "").trim();
      return EXTERNAL_URL_PATTERN.test(url)
        ? { kind: "external", url }
        : { kind: "invalid", reason: "banner 外链地址非法" };
    }
    default:
      return { kind: "invalid", reason: `未知 jump_type=${banner.jump_type}` };
  }
}
