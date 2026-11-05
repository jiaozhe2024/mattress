import { describe, it, expect } from "vitest";
import { resolveBannerTarget } from "@/utils/jump";
import type { WxBanner } from "@/types/home";

function makeBanner(over: Partial<WxBanner>): WxBanner {
  return {
    id: 1,
    image: "/uploads/demo/banner.jpg",
    jump_type: 1,
    jump_value: null,
    sort: 1,
    ...over,
  };
}

describe("resolveBannerTarget（aaa.md §3.2.2 jump_type 1~4 分发）", () => {
  it("jump_type=1 无跳转", () => {
    expect(resolveBannerTarget(makeBanner({ jump_type: 1 }))).toEqual({
      kind: "none",
    });
  });

  it("jump_type=2 解析分类 id", () => {
    expect(
      resolveBannerTarget(makeBanner({ jump_type: 2, jump_value: "3" }))
    ).toEqual({ kind: "category", categoryId: 3 });
  });

  it("jump_type=3 解析产品 id", () => {
    expect(
      resolveBannerTarget(makeBanner({ jump_type: 3, jump_value: "12" }))
    ).toEqual({ kind: "product", productId: 12 });
  });

  it("jump_type=4 接受 http/https 外链", () => {
    expect(
      resolveBannerTarget(
        makeBanner({ jump_type: 4, jump_value: "https://example.com/a" })
      )
    ).toEqual({ kind: "external", url: "https://example.com/a" });
    expect(
      resolveBannerTarget(
        makeBanner({ jump_type: 4, jump_value: "http://example.com" })
      )
    ).toEqual({ kind: "external", url: "http://example.com" });
  });

  it("jump_type=2/3 跳转值缺失或非正整数 → invalid", () => {
    for (const bad of [null, "", "  ", "abc", "-1", "0", "1.5"]) {
      const target = resolveBannerTarget(
        makeBanner({ jump_type: 2, jump_value: bad })
      );
      expect(target.kind, `jump_value=${bad}`).toBe("invalid");
    }
  });

  it("jump_type=4 非 http(s) 或空值 → invalid", () => {
    for (const bad of [null, "", "ftp://x.com", "javascript:alert(1)", "example.com"]) {
      const target = resolveBannerTarget(
        makeBanner({ jump_type: 4, jump_value: bad })
      );
      expect(target.kind, `jump_value=${bad}`).toBe("invalid");
    }
  });

  it("未知 jump_type → invalid", () => {
    const target = resolveBannerTarget(makeBanner({ jump_type: 9 }));
    expect(target.kind).toBe("invalid");
  });
});
