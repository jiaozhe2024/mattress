import { vi, describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/utils/request", () => ({
  get: vi.fn(),
}));

import { get } from "@/utils/request";
import {
  SORT_TABS,
  backendSortOf,
  getCategories,
  getProducts,
  toSelectionProduct,
} from "@/api/product";
import { useSelectionStore } from "@/stores/useSelectionStore";
import type { WxProductListItem } from "@/types/product";

const mockGet = get as unknown as ReturnType<typeof vi.fn>;

function makeItem(overrides: Partial<WxProductListItem> = {}): WxProductListItem {
  return {
    id: 9,
    category_id: 3,
    category_name: "卷绵时代",
    name: "云卷Pro",
    model: "YJ-Pro",
    slogan: "把云睡在身上",
    spec: "180×200×26cm",
    sleep_feel: "适中偏软",
    main_image: "/uploads/p9.jpg",
    sort: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
});

describe("api/product（BE-05 契约映射）", () => {
  it("SORT_TABS：仅向后端传 comprehensive/newest（推荐回退综合）", () => {
    expect(SORT_TABS.map((t) => t.key)).toEqual([
      "comprehensive",
      "recommended",
      "newest",
    ]);
    expect(backendSortOf("comprehensive")).toBe("comprehensive");
    expect(backendSortOf("recommended")).toBe("comprehensive");
    expect(backendSortOf("newest")).toBe("newest");
    const backendValues = new Set(SORT_TABS.map((t) => t.backendSort));
    expect([...backendValues].sort()).toEqual(["comprehensive", "newest"]);
  });

  it("getProducts：默认 page=1/size=10/sort=comprehensive，silent 不弹全局 toast", async () => {
    const payload = { items: [], total: 0, page: 1, size: 10 };
    mockGet.mockResolvedValue(payload);
    await expect(getProducts()).resolves.toBe(payload);
    expect(mockGet).toHaveBeenCalledWith(
      "/wxapi/products",
      { page: 1, size: 10, sort: "comprehensive" },
      { silent: true }
    );
  });

  it("getProducts：显式 query 覆盖默认值", async () => {
    mockGet.mockResolvedValue({ items: [], total: 0, page: 2, size: 20 });
    await getProducts({ page: 2, size: 20, category_id: 5, keyword: "卷绵", sort: "newest" });
    expect(mockGet).toHaveBeenCalledWith(
      "/wxapi/products",
      { page: 2, size: 20, category_id: 5, keyword: "卷绵", sort: "newest" },
      { silent: true }
    );
  });

  it("getCategories：GET /wxapi/categories 且 silent", async () => {
    mockGet.mockResolvedValue([{ id: 1, name: "9M特制床垫" }]);
    const result = await getCategories();
    expect(result).toEqual([{ id: 1, name: "9M特制床垫" }]);
    expect(mockGet).toHaveBeenCalledWith(
      "/wxapi/categories",
      undefined,
      { silent: true }
    );
  });

  it("toSelectionProduct：保留 store 契约字段，null 可选字段不扩散", () => {
    const mapped = toSelectionProduct(makeItem());
    expect(mapped).toEqual({
      id: 9,
      name: "云卷Pro",
      model: "YJ-Pro",
      main_image: "/uploads/p9.jpg",
      slogan: "把云睡在身上",
      spec: "180×200×26cm",
      sleep_feel: "适中偏软",
    });
    expect(mapped).not.toHaveProperty("category_id");
    expect(mapped).not.toHaveProperty("category_name");
    expect(mapped).not.toHaveProperty("sort");

    const sparse = toSelectionProduct(
      makeItem({ slogan: null, spec: null, sleep_feel: null })
    );
    expect(sparse).not.toHaveProperty("slogan");
    expect(sparse).not.toHaveProperty("spec");
    expect(sparse).not.toHaveProperty("sleep_feel");
  });

  it("store 集成：映射结果加入 useSelectionStore，去重且可移除", () => {
    const store = useSelectionStore();
    const item = makeItem();
    store.addProduct(toSelectionProduct(item));
    store.addProduct(toSelectionProduct(makeItem())); // 同 id 重复加入
    expect(store.selectedCount).toBe(1);
    expect(store.selectedProducts[0].name).toBe("云卷Pro");
    store.addProduct(toSelectionProduct(makeItem({ id: 10, name: "云卷Air" })));
    expect(store.selectedCount).toBe(2);
    store.removeProduct(9);
    expect(store.selectedProducts.map((p) => p.id)).toEqual([10]);
  });
});
