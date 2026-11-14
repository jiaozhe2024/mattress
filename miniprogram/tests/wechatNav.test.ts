// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import WechatNav from "@/components/frame/WechatNav.vue";
import { styleOf } from "./helpers/domStyle";

const IPHONE_X_MENU = {
  top: 48,
  bottom: 80,
  left: 281,
  right: 368,
  width: 87,
  height: 32,
};

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
});

describe("WechatNav（一级页 / 二级页差异）", () => {
  it("一级页：左侧 LEKASI 品牌缩写，无返回按钮", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => IPHONE_X_MENU,
      getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    };
    const wrapper = mount(WechatNav, { props: { title: "乐卡思 LEKASI" } });
    expect(wrapper.find(".wnav-brand").exists()).toBe(true);
    expect(wrapper.find(".wnav-brand").text()).toBe("LEKASI");
    expect(wrapper.find(".wnav-back").exists()).toBe(false);
    expect(wrapper.find(".wnav-title").text()).toBe("乐卡思 LEKASI");
  });

  it("二级页（back）：左侧 chevron-left 图标，无品牌字", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => IPHONE_X_MENU,
      getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    };
    const wrapper = mount(WechatNav, { props: { title: "产品详情", back: true } });
    expect(wrapper.find(".wnav-back").exists()).toBe(true);
    expect(wrapper.find(".icon--chevron-left").exists()).toBe(true);
    expect(wrapper.find(".wnav-brand").exists()).toBe(false);
  });

  it("标题居中且使用 text1 色（通过类名 + 结构校验）", () => {
    (globalThis as { uni?: unknown }).uni = {};
    const wrapper = mount(WechatNav, { props: { title: "我的" } });
    expect(wrapper.find(".wnav-center .wnav-title").exists()).toBe(true);
  });

  it("导航总高使用 getMenuButtonBoundingClientRect 计算结果（状态栏 padding + 标题高）", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => IPHONE_X_MENU,
      getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    };
    const wrapper = mount(WechatNav, { props: { title: "首页" } });
    expect(styleOf(wrapper.find(".wnav-root").element).paddingTop).toBe("44px");
    expect(styleOf(wrapper.find(".wnav-bar").element).height).toBe("40px");
    expect(wrapper.attributes("data-nav-fallback")).toBe("0");
  });

  it("胶囊接口异常 → 兜底：状态栏 32 + 标题 44，右侧留白 92", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => {
        throw new Error("unavailable");
      },
      getSystemInfoSync: () => {
        throw new Error("unavailable");
      },
    };
    const wrapper = mount(WechatNav, { props: { title: "首页" } });
    expect(wrapper.attributes("data-nav-fallback")).toBe("1");
    expect(styleOf(wrapper.find(".wnav-root").element).paddingTop).toBe("32px");
    expect(styleOf(wrapper.find(".wnav-bar").element).height).toBe("44px");
    expect(styleOf(wrapper.find(".wnav-right").element).width).toBe("92px");
  });

  it("fixed 模式输出等高占位块，避免遮挡正文", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => IPHONE_X_MENU,
      getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    };
    const wrapper = mount(WechatNav, { props: { title: "首页", fixed: true } });
    expect(wrapper.find(".wnav-spacer").exists()).toBe(true);
    expect(styleOf(wrapper.find(".wnav-spacer").element).height).toBe("84px");
    expect(wrapper.find(".wnav-root--fixed").exists()).toBe(true);
  });

  it("返回按钮点击调用 uni.navigateBack；失败时回首页", async () => {
    const calls: string[] = [];
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => IPHONE_X_MENU,
      getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
      navigateBack: (options?: { fail?: () => void }) => {
        calls.push("navigateBack");
        options?.fail?.();
      },
      switchTab: (options: { url: string }) => calls.push(`switchTab:${options.url}`),
    };
    const wrapper = mount(WechatNav, { props: { title: "产品详情", back: true } });
    await wrapper.find(".wnav-back").trigger("tap");
    expect(calls).toEqual([
      "navigateBack",
      "switchTab:/pages/index/index",
    ]);
  });
});
