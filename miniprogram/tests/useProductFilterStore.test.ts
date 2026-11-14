import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useProductFilterStore } from "@/stores/useProductFilterStore";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("useProductFilterStore（首页 → 产品列表 tab 的筛选传参，Pinia 约定 9）", () => {
  it("初始无请求分类、无请求关键词", () => {
    const store = useProductFilterStore();
    expect(store.requestedCategoryId).toBeNull();
    expect(store.requestedKeyword).toBeNull();
  });

  it("requestCategory 记录分类 id，后写覆盖前写", () => {
    const store = useProductFilterStore();
    store.requestCategory(3);
    expect(store.requestedCategoryId).toBe(3);
    store.requestCategory(7);
    expect(store.requestedCategoryId).toBe(7);
  });

  it("requestKeyword 记录型号关键词（Q15 寝具入口 9B/9D/9P）", () => {
    const store = useProductFilterStore();
    store.requestKeyword("9B");
    expect(store.requestedKeyword).toBe("9B");
  });

  it("分类与关键词互斥：后写覆盖前写，避免双条件导致空结果", () => {
    const store = useProductFilterStore();
    store.requestCategory(5);
    store.requestKeyword("9D");
    expect(store.requestedCategoryId).toBeNull();
    expect(store.requestedKeyword).toBe("9D");

    store.requestCategory(6);
    expect(store.requestedCategoryId).toBe(6);
    expect(store.requestedKeyword).toBeNull();
  });

  it("clearRequest 重置分类与关键词", () => {
    const store = useProductFilterStore();
    store.requestKeyword("9P");
    store.clearRequest();
    expect(store.requestedCategoryId).toBeNull();
    expect(store.requestedKeyword).toBeNull();
  });
});
