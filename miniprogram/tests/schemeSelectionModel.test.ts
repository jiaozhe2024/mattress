import { describe, expect, it } from "vitest";
import {
  DETAIL_LABEL,
  OK_LABEL,
  SCHEME_EDIT_PENDING_TOAST,
  SELECTED_COUNT_PREFIX,
  SELECTION_NAV_TITLE,
  SELECTION_SEARCH_PLACEHOLDER,
  isProductSelected,
  selectedCountText,
  specTextOf,
  thumbnailsOf,
} from "@/components/scheme/schemeSelectionModel";
import type { Product, WxProductListItem } from "@/types/product";

function makeProduct(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    name: `产品${id}`,
    model: `M-${id}`,
    main_image: `/uploads/p${id}.jpg`,
    ...overrides,
  };
}

function makeListItem(overrides: Partial<WxProductListItem> = {}): WxProductListItem {
  return {
    id: 1,
    category_id: 1,
    category_name: "6S专属床垫",
    name: "卷绵1号护脊款",
    model: "M-1",
    slogan: null,
    spec: "1800 × 2000 mm",
    sleep_feel: "舒适睡感",
    main_image: "/uploads/p1.jpg",
    sort: 0,
    ...overrides,
  };
}

describe("选品页文案常量（spec.md §5.6 逐字）", () => {
  it("导航标题为 LEKASI 乐卡思", () => {
    expect(SELECTION_NAV_TITLE).toBe("LEKASI 乐卡思");
  });

  it("搜索占位为「输入型号搜索」", () => {
    expect(SELECTION_SEARCH_PLACEHOLDER).toBe("输入型号搜索");
  });

  it("已选前缀为全角冒号「已选：」", () => {
    expect(SELECTED_COUNT_PREFIX).toBe("已选：");
  });

  it("OK 与查看详情文案", () => {
    expect(OK_LABEL).toBe("OK");
    expect(DETAIL_LABEL).toBe("查看详情");
  });

  it("方案编辑页占位 toast 文案非空", () => {
    expect(SCHEME_EDIT_PENDING_TOAST.length).toBeGreaterThan(0);
  });
});

describe("selectedCountText", () => {
  it("拼接「已选：N」", () => {
    expect(selectedCountText(0)).toBe("已选：0");
    expect(selectedCountText(2)).toBe("已选：2");
    expect(selectedCountText(12)).toBe("已选：12");
  });

  it("负数与非有限值归一为 0，小数向下取整", () => {
    expect(selectedCountText(-3)).toBe("已选：0");
    expect(selectedCountText(Number.NaN)).toBe("已选：0");
    expect(selectedCountText(2.9)).toBe("已选：2");
  });
});

describe("specTextOf", () => {
  it("优先 spec 字段并去首尾空白", () => {
    expect(specTextOf(makeListItem())).toBe("1800 × 2000 mm");
    expect(specTextOf(makeListItem({ spec: "  1900 × 2000 mm  " }))).toBe(
      "1900 × 2000 mm"
    );
  });

  it("spec 缺省（null/undefined）回退空串", () => {
    expect(specTextOf(makeListItem({ spec: null }))).toBe("");
    expect(specTextOf(makeProduct(1))).toBe("");
  });
});

describe("isProductSelected", () => {
  it("按 id 命中即已选", () => {
    const selected = [makeProduct(1), makeProduct(3)];
    expect(isProductSelected(selected, 1)).toBe(true);
    expect(isProductSelected(selected, 2)).toBe(false);
  });

  it("空列表恒为未选", () => {
    expect(isProductSelected([], 1)).toBe(false);
  });
});

describe("thumbnailsOf", () => {
  it("完整保留已选顺序（区宽 150 内横向滚动，不截断）", () => {
    const selected = [makeProduct(3), makeProduct(1), makeProduct(2)];
    expect(thumbnailsOf(selected).map((p) => p.id)).toEqual([3, 1, 2]);
  });

  it("返回同一引用视图，不做拷贝", () => {
    const selected = [makeProduct(1)];
    expect(thumbnailsOf(selected)).toBe(selected);
  });
});
