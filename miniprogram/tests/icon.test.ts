// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "@/components/icons/Icon.vue";
import { ICON_NAMES, iconBoxStyle, iconDataUri, generateIconSvg } from "@/utils/iconSvg";

/** asset-inventory.md 要求覆盖的 15 个图标。 */
const REQUIRED_ICONS = [
  "home",
  "grid",
  "user",
  "undo-2",
  "chevron-left",
  "chevron-right",
  "chevron-down",
  "search",
  "list",
  "pencil",
  "plus",
  "share",
  "qr-code",
  "message-circle",
  "newspaper",
];

describe("Icon（内联 SVG，lucide 线性 path）", () => {
  it("覆盖 asset-inventory.md 全部 15 个图标", () => {
    expect(ICON_NAMES.slice().sort()).toEqual(REQUIRED_ICONS.slice().sort());
  });

  it("每个图标都有非空 path 且以 24×24 viewBox 输出", () => {
    for (const name of REQUIRED_ICONS) {
      const svg = generateIconSvg(name);
      expect(svg, name).toContain('viewBox="0 0 24 24"');
      expect(svg, name).toContain('fill="none"');
      expect(svg.length, name).toBeGreaterThan(120);
    }
  });

  it("size/color 透传到 SVG 宽度与 stroke", () => {
    const svg = generateIconSvg("home", { size: 22, color: "#f7c400" });
    expect(svg).toContain('width="22"');
    expect(svg).toContain('stroke="#f7c400"');
  });

  it("未知图标返回空图形而不抛错（防页面白屏）", () => {
    expect(() => generateIconSvg("not-exist")).not.toThrow();
    expect(generateIconSvg("not-exist")).toContain("<svg");
  });

  it("data URI 编码可被 image 使用且 # 被转义", () => {
    const uri = iconDataUri("home", { color: "#1a2260" });
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(uri).not.toContain("#");
    expect(decodeURIComponent(uri.split(",")[1])).toContain('stroke="#1a2260"');
  });

  it("按设计 px 折算 rpx（24px → 48rpx；jsdom 不解析 rpx，故直测折算函数）", () => {
    expect(iconBoxStyle(24)).toBe("width:48rpx;height:48rpx;");
    expect(iconBoxStyle(22)).toBe("width:44rpx;height:44rpx;");
  });

  it("组件渲染 image，src 为 data URI，带图标名类名", () => {
    const wrapper = mount(Icon, { props: { name: "user", size: 24 } });
    const img = wrapper.find("image");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toContain("data:image/svg+xml");
    expect(img.classes()).toContain("icon--user");
  });
});
