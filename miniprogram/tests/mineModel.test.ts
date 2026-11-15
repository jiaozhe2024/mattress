import { describe, it, expect } from "vitest";
import {
  MINE_BRAND,
  MINE_CONTACT_LINE,
  MINE_INTRO_LINES,
  MINE_LEARN_LABEL,
  MINE_NAV_TITLE,
  MINE_SERVICE_ITEMS,
  MINE_SERVICE_LEARN,
  MINE_SERVICE_TITLE,
  MINE_SLOGAN,
  MINE_SPACE_CAPTION,
  hasCustomerServiceConfig,
  introLinesOf,
  joinPhoneOf,
  spaceImageOf,
} from "@/components/user/mineModel";
import type { WxBrandInfo } from "@/types/home";

function makeBrand(overrides: Partial<WxBrandInfo> = {}): WxBrandInfo {
  return {
    id: 1,
    intro: null,
    join_phone: null,
    service_promise: null,
    store_images: null,
    ...overrides,
  };
}

describe("「我的」页文案常量（spec §5.10）", () => {
  it("导航标题与品牌行一致", () => {
    expect(MINE_NAV_TITLE).toBe("LEKASI 乐卡思");
    expect(MINE_BRAND).toBe("LEKASI 乐卡思");
  });

  it("主标语为「遇见舒适好眠」", () => {
    expect(MINE_SLOGAN).toBe("遇见舒适好眠");
  });

  it("三行品牌理念与稿内一致", () => {
    expect(MINE_INTRO_LINES).toEqual([
      "从一张床垫开始，认真对待每一次休息。",
      "在这里了解产品、挑选睡感，",
      "也把喜欢的选择分享给朋友与家人。",
    ]);
  });

  it("空间图图注与联系文案", () => {
    expect(MINE_SPACE_CAPTION).toBe("家居展示空间示意");
    expect(MINE_LEARN_LABEL).toBe("了解乐卡思");
    expect(MINE_CONTACT_LINE).toBe("产品咨询 · 体验交流 · 合作联系");
  });

  it("客服区块标题与三项服务", () => {
    expect(MINE_SERVICE_TITLE).toBe("乐卡思客服");
    expect(MINE_SERVICE_ITEMS.map((item) => item.title)).toEqual([
      "产品咨询",
      "睡感选择",
      "使用建议",
    ]);
    // 每项说明均为「了解更多」（spec §5.10 客服内容表）
    expect(MINE_SERVICE_ITEMS.every((item) => item.caption === MINE_SERVICE_LEARN))
      .toBe(true);
    expect(MINE_SERVICE_LEARN).toBe("了解更多");
  });

  it("客服项 key 唯一（v-for :key 依赖）", () => {
    const keys = MINE_SERVICE_ITEMS.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("introLinesOf（品牌理念兜底）", () => {
  it("brand 为 null 时回落稿内三行", () => {
    expect(introLinesOf(null)).toEqual(MINE_INTRO_LINES);
  });

  it("intro 为 null / 空串 / 纯空白时回落稿内三行", () => {
    expect(introLinesOf(makeBrand({ intro: null }))).toEqual(MINE_INTRO_LINES);
    expect(introLinesOf(makeBrand({ intro: "" }))).toEqual(MINE_INTRO_LINES);
    expect(introLinesOf(makeBrand({ intro: "   \n\t " }))).toEqual(MINE_INTRO_LINES);
  });

  it("有 intro 时整体作为一行返回（不按句号强行拆行）", () => {
    const intro = "第一句。第二句。第三句。";
    expect(introLinesOf(makeBrand({ intro }))).toEqual([intro]);
  });

  it("trim 掉首尾空白但保留中间内容", () => {
    expect(introLinesOf(makeBrand({ intro: "  乐卡思好眠  " }))).toEqual([
      "乐卡思好眠",
    ]);
  });
});

describe("spaceImageOf（空间图取图）", () => {
  it("brand 为 null 或 store_images 为空时返回空串", () => {
    expect(spaceImageOf(null)).toBe("");
    expect(spaceImageOf(makeBrand({ store_images: null }))).toBe("");
    expect(spaceImageOf(makeBrand({ store_images: [] }))).toBe("");
  });

  it("取第一张非空图（跳过空串与纯空白项）", () => {
    expect(
      spaceImageOf(makeBrand({ store_images: ["", "  ", "/uploads/a.jpg", "/uploads/b.jpg"] }))
    ).toBe("/uploads/a.jpg");
  });

  it("全部为空项时返回空串（页面走占位层）", () => {
    expect(spaceImageOf(makeBrand({ store_images: ["", "   "] }))).toBe("");
  });
});

describe("joinPhoneOf（加盟电话）", () => {
  it("brand 为 null 或无 join_phone 时返回空串", () => {
    expect(joinPhoneOf(null)).toBe("");
    expect(joinPhoneOf(makeBrand({ join_phone: null }))).toBe("");
  });

  it("返回 trim 后的号码", () => {
    expect(joinPhoneOf(makeBrand({ join_phone: " 400-000-0000 " }))).toBe(
      "400-000-0000"
    );
  });
});

describe("hasCustomerServiceConfig（客服可用性判定）", () => {
  it("corpId 与 kfUrl 都有真实值时为 true", () => {
    expect(
      hasCustomerServiceConfig({
        corpId: "ww1234567890abcdef",
        kfUrl: "https://work.weixin.qq.com/kf/abc",
      })
    ).toBe(true);
  });

  it("任一为空/纯空白时为 false", () => {
    expect(hasCustomerServiceConfig({ corpId: "", kfUrl: "https://x" })).toBe(false);
    expect(hasCustomerServiceConfig({ corpId: "ww1", kfUrl: "" })).toBe(false);
    expect(hasCustomerServiceConfig({ corpId: "  ", kfUrl: "https://x" })).toBe(false);
    expect(hasCustomerServiceConfig({ corpId: "ww1", kfUrl: "   " })).toBe(false);
  });

  it("占位值（含 placeholder）判为未配置，避免调用必然失败的开放能力", () => {
    // config.ts 当前值——未开通前必须走 toast 兜底
    expect(
      hasCustomerServiceConfig({
        corpId: "ww_placeholder_corp_id",
        kfUrl: "https://work.weixin.qq.com/kf/placeholder",
      })
    ).toBe(false);
    // 大小写不敏感
    expect(
      hasCustomerServiceConfig({ corpId: "WW_PLACEHOLDER", kfUrl: "https://x" })
    ).toBe(false);
  });
});
