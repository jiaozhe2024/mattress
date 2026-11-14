// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import TabBar from "@/components/frame/TabBar.vue";
import { tabBarItemsOf } from "@/components/frame/tabBarModel";

function mountTabBar(props: Record<string, unknown> = {}) {
  return mount(TabBar, { props });
}

describe("TabBar（Q1：three / two 同一组件 variant）", () => {
  it("three 渲染 3 项：首页 / 产品 / 我的", () => {
    const wrapper = mountTabBar({ variant: "three" });
    const items = wrapper.findAll(".tabbar-item");
    expect(items).toHaveLength(3);
    expect(items.map((el) => el.text())).toEqual(["首页", "产品", "我的"]);
    expect(wrapper.attributes("data-variant")).toBe("three");
  });

  it("two 渲染 2 项：首页 / 返回（undo-2）", () => {
    const wrapper = mountTabBar({ variant: "two" });
    const items = wrapper.findAll(".tabbar-item");
    expect(items).toHaveLength(2);
    expect(items.map((el) => el.text())).toEqual(["首页", "返回"]);
    expect(wrapper.attributes("data-variant")).toBe("two");
  });

  it("两套 variant 的图标名符合规格（undo-2 仅 two 使用）", () => {
    const three = tabBarItemsOf("three").map((item) => item.icon);
    const two = tabBarItemsOf("two").map((item) => item.icon);
    expect(three).toEqual(["home", "grid", "user"]);
    expect(two).toEqual(["home", "undo-2"]);
  });

  it("three 缺省选中首页（activeIndex=0），其余项 60% 透明", () => {
    const wrapper = mountTabBar({ variant: "three" });
    const items = wrapper.findAll(".tabbar-item");
    expect(items[0].classes()).toContain("tabbar-item--active");
    expect(items[1].classes()).not.toContain("tabbar-item--active");
    expect(items[2].classes()).not.toContain("tabbar-item--active");
  });

  it("two 缺省无选中项（返回项不可选中）", () => {
    const wrapper = mountTabBar({ variant: "two" });
    const items = wrapper.findAll(".tabbar-item");
    expect(items.every((el) => !el.classes().includes("tabbar-item--active"))).toBe(
      true
    );
  });

  it("显式 active 生效；越界时无选中", () => {
    const wrapper = mountTabBar({ variant: "three", active: 2 });
    expect(wrapper.findAll(".tabbar-item")[2].classes()).toContain(
      "tabbar-item--active"
    );

    const overflow = mountTabBar({ variant: "three", active: 9 });
    expect(
      overflow
        .findAll(".tabbar-item")
        .every((el) => !el.classes().includes("tabbar-item--active"))
    ).toBe(true);
  });

  it("点击「返回」项触发 navigateBack，不切换 tab", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      navigateBack: () => calls.push("navigateBack"),
      switchTab: (options: { url: string }) => calls.push(`switchTab:${options.url}`),
    };
    const wrapper = mountTabBar({ variant: "two" });
    await wrapper.findAll(".tabbar-item")[1].trigger("tap");
    expect(calls).toEqual(["navigateBack"]);

    delete (globalThis as { uni?: unknown }).uni;
  });

  it("three 点击非当前项 → switchTab 到对应 tab 页并 emit change", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      switchTab: (options: { url: string }) => calls.push(options.url),
    };
    const wrapper = mountTabBar({ variant: "three" });
    await wrapper.findAll(".tabbar-item")[1].trigger("tap");
    expect(calls).toEqual(["/pages/product/category"]);
    expect(wrapper.emitted("change")?.[0]).toEqual([
      1,
      expect.objectContaining({ key: "product" }),
    ]);

    delete (globalThis as { uni?: unknown }).uni;
  });

  it("three 点击当前已选中项不重复 switchTab", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      switchTab: (options: { url: string }) => calls.push(options.url),
    };
    const wrapper = mountTabBar({ variant: "three", active: 0 });
    await wrapper.findAll(".tabbar-item")[0].trigger("tap");
    expect(calls).toEqual([]);

    delete (globalThis as { uni?: unknown }).uni;
  });
});

describe("TabBar 视觉规格（design-tokens.md / visual-checklist.md）", () => {
  it("单个组件同时承载两套结构，组件内无 variant 分支的独立组件文件", () => {
    // 结构性约束：TabBar.vue 必须同时实现 three/two（同组件），不得拆两个组件
    expect(tabBarItemsOf("three")).toHaveLength(3);
    expect(tabBarItemsOf("two")).toHaveLength(2);
  });
});
