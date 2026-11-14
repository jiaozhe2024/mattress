import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_TITLE,
  parseCategoryId,
  productDetailUrlOf,
  resolvePageTitle,
  sleepFeelTagOf,
} from "@/components/product/productListModel";
import type { WxCategory } from "@/types/home";
import type { WxProductListItem } from "@/types/product";

function makeCategory(id: number, name: string): WxCategory {
  return { id, name, subtitle: "", icon: null, banner_image: null, sort: id };
}

function makeProduct(overrides: Partial<WxProductListItem> = {}): WxProductListItem {
  return {
    id: 1,
    category_id: 1,
    category_name: "6S专属床垫",
    name: "3D床垫",
    model: "M-1",
    slogan: null,
    spec: "1800 × 2000 mm",
    sleep_feel: "舒适睡感",
    main_image: "/uploads/p1.png",
    sort: 0,
    ...overrides,
  };
}

const CATEGORIES = [
  makeCategory(1, "6S专属床垫"),
  makeCategory(2, "手工 · 零胶虑"),
];

describe("resolvePageTitle（二级页导航标题）", () => {
  it("category_id 命中分类表 → 分类名", () => {
    expect(resolvePageTitle(2, CATEGORIES)).toBe("手工 · 零胶虑");
  });

  it("category_id 未命中 → 回退 query 直传名称", () => {
    expect(resolvePageTitle(99, CATEGORIES, "薄垫 · 不薄待")).toBe(
      "薄垫 · 不薄待"
    );
  });

  it("分类表未加载 + 无 query 名称 → 兜底「产品」", () => {
    expect(resolvePageTitle(1, [])).toBe(DEFAULT_PAGE_TITLE);
    expect(resolvePageTitle(null, [])).toBe("产品");
  });

  it("空字符串名称视为未提供", () => {
    expect(resolvePageTitle(null, CATEGORIES, "   ")).toBe("产品");
  });
});

describe("parseCategoryId（onLoad query 解析）", () => {
  it("正整数通过", () => {
    expect(parseCategoryId("3")).toBe(3);
    expect(parseCategoryId(8)).toBe(8);
  });

  it("空值 / 非数字 / 非正整数 → null", () => {
    expect(parseCategoryId(undefined)).toBeNull();
    expect(parseCategoryId("")).toBeNull();
    expect(parseCategoryId("abc")).toBeNull();
    expect(parseCategoryId("0")).toBeNull();
    expect(parseCategoryId("-2")).toBeNull();
    expect(parseCategoryId("1.5")).toBeNull();
  });
});

describe("productDetailUrlOf（详情跳转）", () => {
  it("拼接 id 到 /pages/product/detail", () => {
    expect(productDetailUrlOf(42)).toBe("/pages/product/detail?id=42");
  });
});

describe("sleepFeelTagOf（卡片睡感标签）", () => {
  it("seed 数据「舒适睡感」原样返回", () => {
    expect(sleepFeelTagOf(makeProduct())).toBe("舒适睡感");
  });

  it("多标签取首个分词", () => {
    expect(sleepFeelTagOf(makeProduct({ sleep_feel: "偏软、适中" }))).toBe("偏软");
  });

  it("空睡感 → 空串（不渲染标签，不臆造）", () => {
    expect(sleepFeelTagOf(makeProduct({ sleep_feel: null }))).toBe("");
    expect(sleepFeelTagOf(makeProduct({ sleep_feel: "   " }))).toBe("");
  });
});
