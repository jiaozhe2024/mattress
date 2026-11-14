// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SafeArea from "@/components/frame/SafeArea.vue";
import { rgb, styleOf } from "./helpers/domStyle";

describe("SafeArea（h22 + 手势条 120×4 圆角 4 #1e2330）", () => {
  it("渲染安全区容器与居中手势条", () => {
    const wrapper = mount(SafeArea);
    expect(wrapper.find(".safe-area").exists()).toBe(true);
    expect(wrapper.find(".safe-area-bar").exists()).toBe(true);
  });

  it("高度取 22 与 env(safe-area-inset-bottom) 的较大值（不被 Home Indicator 遮挡）", () => {
    const wrapper = mount(SafeArea);
    expect(styleOf(wrapper.find(".safe-area").element).height).toBe(
      "max(22px, env(safe-area-inset-bottom))"
    );
  });

  it("支持自定义底色（默认白）", () => {
    const wrapper = mount(SafeArea, { props: { background: "#1a2260" } });
    expect(styleOf(wrapper.find(".safe-area").element).background).toBe(
      rgb("#1a2260")
    );

    const defaulted = mount(SafeArea);
    expect(styleOf(defaulted.find(".safe-area").element).background).toBe(
      rgb("#ffffff")
    );
  });
});
