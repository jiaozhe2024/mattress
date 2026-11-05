import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSelectionStore } from "@/stores/useSelectionStore";
import type { Product } from "@/types/product";

function makeProduct(id: number): Product {
  return {
    id,
    name: `产品${id}`,
    model: `M-${id}`,
    main_image: `https://cdn.example.com/p${id}.jpg`,
    spec: "180×200×26cm",
    sleep_feel: "适中偏硬",
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("useSelectionStore", () => {
  it("初始状态：已选列表为空、当前方案 ID 为 null", () => {
    const store = useSelectionStore();
    expect(store.selectedProducts).toEqual([]);
    expect(store.currentSchemeId).toBeNull();
    expect(store.selectedCount).toBe(0);
  });

  it("addProduct：可加入产品且 selectedCount 增加", () => {
    const store = useSelectionStore();
    store.addProduct(makeProduct(1));
    expect(store.selectedCount).toBe(1);
    store.addProduct(makeProduct(2));
    expect(store.selectedCount).toBe(2);
    expect(store.selectedProducts.map((p) => p.id)).toEqual([1, 2]);
  });

  it("addProduct：同 id 产品去重，数量不重复累计", () => {
    const store = useSelectionStore();
    store.addProduct(makeProduct(1));
    store.addProduct(makeProduct(1));
    store.addProduct(makeProduct(1));
    expect(store.selectedCount).toBe(1);
    expect(store.selectedProducts[0].name).toBe("产品1");
  });

  it("removeProduct：按 id 移除，未命中时无副作用", () => {
    const store = useSelectionStore();
    store.addProduct(makeProduct(1));
    store.addProduct(makeProduct(2));
    store.removeProduct(1);
    expect(store.selectedCount).toBe(1);
    expect(store.selectedProducts[0].id).toBe(2);
    store.removeProduct(999);
    expect(store.selectedCount).toBe(1);
  });

  it("clearSelection：清空已选并重置当前方案 ID", () => {
    const store = useSelectionStore();
    store.addProduct(makeProduct(1));
    store.addProduct(makeProduct(2));
    store.currentSchemeId = 88;
    store.clearSelection();
    expect(store.selectedProducts).toEqual([]);
    expect(store.selectedCount).toBe(0);
    expect(store.currentSchemeId).toBeNull();
  });

  it("selectedCount 是 getter，随列表实时变化", () => {
    const store = useSelectionStore();
    expect(store.selectedCount).toBe(0);
    store.addProduct(makeProduct(3));
    expect(store.selectedCount).toBe(1);
    store.removeProduct(3);
    expect(store.selectedCount).toBe(0);
  });
});