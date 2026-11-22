import { describe, expect, it } from "vitest";
import {
  ADD_PRODUCT_LABEL,
  DETAIL_TOGGLE_LABEL,
  EDIT_NAV_TITLE,
  PRODUCT_COUNT_PREFIX,
  REMARK_MAX_LENGTH,
  SCHEME_ACTION_BUTTONS,
  SCHEME_LIST_PENDING_TOAST,
  SCHEME_PREVIEW_PENDING_TOAST,
  SAVE_FAILED_MESSAGE,
  TITLE_MAX_LENGTH,
  TITLE_PLACEHOLDER,
  TITLE_REQUIRED_MESSAGE,
  TITLE_TOO_LONG_MESSAGE,
  buildSchemePayload,
  productCountText,
  validateSchemeTitle,
} from "@/components/scheme/schemeEditModel";

describe("方案编辑页文案常量（spec.md §5.5 / §5.7，逐字固定）", () => {
  it("导航/占位/添加产品/数量/详细说明文案", () => {
    expect(EDIT_NAV_TITLE).toBe("LEKASI 乐卡思");
    expect(TITLE_PLACEHOLDER).toBe("方案标题");
    expect(ADD_PRODUCT_LABEL).toBe("添加产品");
    expect(PRODUCT_COUNT_PREFIX).toBe("产品数量：");
    expect(DETAIL_TOGGLE_LABEL).toBe("详细说明");
  });

  it("标题与备注长度上限分别对齐后端 100 / 2000", () => {
    expect(TITLE_MAX_LENGTH).toBe(100);
    expect(REMARK_MAX_LENGTH).toBe(2000);
  });

  it("兜底 toast 文案非空", () => {
    expect(SCHEME_LIST_PENDING_TOAST).not.toBe("");
    expect(SCHEME_PREVIEW_PENDING_TOAST).not.toBe("");
    expect(SAVE_FAILED_MESSAGE).not.toBe("");
  });
});

describe("Q3：三按钮为一份可配 variant 配置", () => {
  it("顺序和文案与设计一致，宽度由布局决定", () => {
    expect(SCHEME_ACTION_BUTTONS.map((btn) => btn.key)).toEqual([
      "mine",
      "save",
      "preview",
    ]);
    expect(SCHEME_ACTION_BUTTONS.map((btn) => btn.label)).toEqual([
      "我的方案",
      "保存",
      "预览分享",
    ]);
    expect(SCHEME_ACTION_BUTTONS.every((btn) => !("width" in btn))).toBe(true);
  });

  it("本轮照稿等权重：我的方案 secondary，保存/预览分享 primary", () => {
    expect(SCHEME_ACTION_BUTTONS.map((btn) => btn.tone)).toEqual([
      "secondary",
      "primary",
      "primary",
    ]);
  });

  it("key 唯一，便于单入口分发", () => {
    const keys = SCHEME_ACTION_BUTTONS.map((btn) => btn.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("标题校验（1-100 字，空标题拦截保存）", () => {
  it("空串 / 纯空白 → 必填提示", () => {
    expect(validateSchemeTitle("")).toBe(TITLE_REQUIRED_MESSAGE);
    expect(validateSchemeTitle("   ")).toBe(TITLE_REQUIRED_MESSAGE);
  });

  it("1 字与 100 字通过", () => {
    expect(validateSchemeTitle("主")).toBeNull();
    expect(validateSchemeTitle("卧".repeat(100))).toBeNull();
  });

  it("101 字 → 超长提示", () => {
    expect(validateSchemeTitle("卧".repeat(101))).toBe(TITLE_TOO_LONG_MESSAGE);
  });

  it("两侧空白不计入长度", () => {
    expect(validateSchemeTitle(`  ${"卧".repeat(100)}  `)).toBeNull();
  });
});

describe("产品数量文案", () => {
  it("0 / N 均输出全角冒号", () => {
    expect(productCountText(0)).toBe("产品数量：0");
    expect(productCountText(2)).toBe("产品数量：2");
  });

  it("非法/负数归零，不输出 NaN", () => {
    expect(productCountText(-1)).toBe("产品数量：0");
    expect(productCountText(Number.NaN)).toBe("产品数量：0");
    expect(productCountText(2.7)).toBe("产品数量：2");
  });
});

describe("保存载荷", () => {
  it("title 去空白、product_ids 拷贝、remark 去空白", () => {
    const ids = [3, 1];
    const payload = buildSchemePayload("  主卧舒适好眠方案  ", ids, "  靠窗一侧  ");
    expect(payload).toEqual({
      title: "主卧舒适好眠方案",
      product_ids: [3, 1],
      remark: "靠窗一侧",
    });
    expect(payload.product_ids).not.toBe(ids);
  });

  it("空备注输出 null（PUT 整体替换语义下可用于清空）", () => {
    expect(buildSchemePayload("标题", [], "   ").remark).toBeNull();
  });
});
