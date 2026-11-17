// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SelectFab from "@/components/frame/SelectFab.vue";
import { useSelectionStore } from "@/stores/useSelectionStore";
import { SCHEME_EDIT_PAGE, SELECTION_PAGE } from "@/config";
import type { Product } from "@/types/product";

function makeProduct(id: number): Product {
  return {
    id,
    name: `产品${id}`,
    model: `M-${id}`,
    main_image: `/uploads/p${id}.jpg`,
  };
}

function mountFab() {
  return mount(SelectFab);
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
});

describe("SelectFab（V3：64×42 胶囊，spec.md §5.1 ⑤）", () => {
  it("渲染胶囊与「选款」文字（保留 .select-fab 类名供骨架 e2e 复用）", () => {
    const wrapper = mountFab();
    expect(wrapper.find(".select-fab").exists()).toBe(true);
    expect(wrapper.find(".select-fab-label").text()).toBe("选款");
  });

  it("未选任何产品时不显示数量角标", () => {
    const wrapper = mountFab();
    expect(wrapper.find(".select-fab-badge").exists()).toBe(false);
  });

  it("已选数量 >0 时显示角标，并随 Pinia 实时更新", async () => {
    const wrapper = mountFab();
    const store = useSelectionStore();
    store.addProduct(makeProduct(1));
    store.addProduct(makeProduct(2));
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".select-fab-badge").exists()).toBe(true);
    expect(wrapper.find(".select-fab-badge-text").text()).toBe("2");
  });

  it("数量超过 99 时角标封顶 99+", async () => {
    const wrapper = mountFab();
    const store = useSelectionStore();
    for (let i = 1; i <= 100; i += 1) {
      store.addProduct(makeProduct(i));
    }
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".select-fab-badge-text").text()).toBe("99+");
  });

  it("store 为空 → 进方案编辑页空态（plan-01-empty.png）", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      navigateTo: (options: { url: string }) => calls.push(`navigateTo:${options.url}`),
      switchTab: (options: { url: string }) => calls.push(`switchTab:${options.url}`),
    };
    const wrapper = mountFab();
    await wrapper.find(".select-fab").trigger("tap");
    // 空选品时不应把用户直接扔进选品页，先进编辑页空态
    expect(calls).toEqual([`navigateTo:${SCHEME_EDIT_PAGE}`]);
  });

  it("store 非空 → 进选品页继续增减", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      navigateTo: (options: { url: string }) => calls.push(`navigateTo:${options.url}`),
      switchTab: (options: { url: string }) => calls.push(`switchTab:${options.url}`),
    };
    const store = useSelectionStore();
    store.addProduct(makeProduct(1));
    const wrapper = mountFab();
    await wrapper.find(".select-fab").trigger("tap");
    expect(calls).toEqual([`navigateTo:${SELECTION_PAGE}`]);
  });

  it("目标页不可用（navigateTo fail）→ 回产品分类 tab 兜底", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      navigateTo: (options: { url: string; fail?: () => void }) => {
        calls.push(`navigateTo:${options.url}`);
        options.fail?.();
      },
      switchTab: (options: { url: string }) => calls.push(`switchTab:${options.url}`),
    };
    const wrapper = mountFab();
    await wrapper.find(".select-fab").trigger("tap");
    expect(calls).toEqual([
      `navigateTo:${SCHEME_EDIT_PAGE}`,
      "switchTab:/pages/product/category",
    ]);
  });
});
