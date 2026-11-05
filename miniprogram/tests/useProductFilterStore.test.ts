import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useProductFilterStore } from "@/stores/useProductFilterStore";

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("useProductFilterStore（首页 → 产品列表 tab 的分类传参，Pinia 约定 9）", () => {
  it("初始无请求分类", () => {
    expect(useProductFilterStore().requestedCategoryId).toBeNull();
  });

  it("requestCategory 记录分类 id，后写覆盖前写", () => {
    const store = useProductFilterStore();
    store.requestCategory(3);
    expect(store.requestedCategoryId).toBe(3);
    store.requestCategory(7);
    expect(store.requestedCategoryId).toBe(7);
  });

  it("clearRequest 重置为 null", () => {
    const store = useProductFilterStore();
    store.requestCategory(2);
    store.clearRequest();
    expect(store.requestedCategoryId).toBeNull();
  });
});
