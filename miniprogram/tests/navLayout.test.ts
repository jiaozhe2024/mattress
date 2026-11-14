import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NAV_TOTAL_HEIGHT,
  DEFAULT_RIGHT_SAFE_WIDTH,
  NAV_TITLE_HEIGHT,
  isValidMenuRect,
  readNavLayout,
  resolveNavLayout,
} from "@/utils/navLayout";

const IPHONE_X_STATUS = 44;
/** iPhone X 常见胶囊：top=48 bottom=80 height=32 left=281 width=87。 */
const IPHONE_X_MENU = {
  top: 48,
  bottom: 80,
  left: 281,
  right: 368,
  width: 87,
  height: 32,
};

describe("resolveNavLayout（getMenuButtonBoundingClientRect 反推）", () => {
  it("正常胶囊：navBar = (top - statusBar) * 2 + height，总高含状态栏", () => {
    const layout = resolveNavLayout({
      menuRect: IPHONE_X_MENU,
      statusBarHeight: IPHONE_X_STATUS,
      windowWidth: 375,
    });
    // (48-44)*2 + 32 = 40
    expect(layout.navBarHeight).toBe(40);
    expect(layout.statusBarHeight).toBe(44);
    expect(layout.totalHeight).toBe(84);
    expect(layout.rightSafeWidth).toBe(375 - 281 + 16);
    expect(layout.fallback).toBe(false);
  });

  it("接口缺失（undefined/null）→ 兜底 44+32=76，右侧留白 92", () => {
    for (const menuRect of [undefined, null]) {
      const layout = resolveNavLayout({
        menuRect,
        statusBarHeight: IPHONE_X_STATUS,
        windowWidth: 375,
      });
      expect(layout.navBarHeight).toBe(NAV_TITLE_HEIGHT);
      expect(layout.totalHeight).toBe(IPHONE_X_STATUS + NAV_TITLE_HEIGHT);
      expect(layout.rightSafeWidth).toBe(DEFAULT_RIGHT_SAFE_WIDTH);
      expect(layout.fallback).toBe(true);
    }
  });

  it("接口抛错场景的替代输入：全 0 矩形判为异常 → 兜底", () => {
    const layout = resolveNavLayout({
      menuRect: { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 },
      statusBarHeight: 20,
      windowWidth: 375,
    });
    expect(layout.fallback).toBe(true);
    expect(layout.navBarHeight).toBe(NAV_TITLE_HEIGHT);
    expect(layout.statusBarHeight).toBe(20);
  });

  it("缺 statusBarHeight 时用设计基准 32", () => {
    for (const statusBarHeight of [undefined, null, 0, NaN]) {
      const layout = resolveNavLayout({
        menuRect: null,
        statusBarHeight,
        windowWidth: 375,
      });
      expect(layout.statusBarHeight).toBe(32);
      expect(layout.totalHeight).toBe(32 + NAV_TITLE_HEIGHT);
    }
  });

  it("缺 windowWidth 时右侧留白仍为兜底值", () => {
    const layout = resolveNavLayout({
      menuRect: IPHONE_X_MENU,
      statusBarHeight: IPHONE_X_STATUS,
      windowWidth: undefined,
    });
    // 以 375 兜底计算
    expect(layout.rightSafeWidth).toBe(375 - 281 + 16);
  });

  it("反推高度超出合理区间 [40,56] → 兜底", () => {
    const tooTall = { ...IPHONE_X_MENU, top: 60, bottom: 92 }; // (60-44)*2+32=64
    expect(
      resolveNavLayout({
        menuRect: tooTall,
        statusBarHeight: 44,
        windowWidth: 375,
      }).fallback
    ).toBe(true);

    const tooShort = { ...IPHONE_X_MENU, top: 44, bottom: 76 }; // gap=0
    expect(
      resolveNavLayout({
        menuRect: tooShort,
        statusBarHeight: 44,
        windowWidth: 375,
      }).fallback
    ).toBe(true);
  });

  it("undefined 入参整体调用也安全（全兜底）", () => {
    const layout = resolveNavLayout();
    expect(layout).toEqual({
      statusBarHeight: 32,
      navBarHeight: NAV_TITLE_HEIGHT,
      totalHeight: DEFAULT_NAV_TOTAL_HEIGHT,
      rightSafeWidth: DEFAULT_RIGHT_SAFE_WIDTH,
      fallback: true,
    });
  });
});

describe("isValidMenuRect（异常值判定）", () => {
  const statusBar = 44;
  const width = 375;

  it("合法矩形通过", () => {
    expect(isValidMenuRect(IPHONE_X_MENU, statusBar, width)).toBe(true);
  });

  it.each([
    ["width 过小", { ...IPHONE_X_MENU, width: 5 }],
    ["height 过小", { ...IPHONE_X_MENU, height: 4 }],
    ["bottom <= top", { ...IPHONE_X_MENU, bottom: 20 }],
    ["right 超屏宽", { ...IPHONE_X_MENU, right: 500 }],
    ["left >= right", { ...IPHONE_X_MENU, left: 400 }],
    ["top 深陷状态栏", { ...IPHONE_X_MENU, top: 10 }],
    ["字段缺失", { top: 48, bottom: 80 }],
    ["NaN", { ...IPHONE_X_MENU, top: Number.NaN }],
  ])("异常矩形被拒绝：%s", (_label, rect) => {
    expect(isValidMenuRect(rect as never, statusBar, width)).toBe(false);
  });
});

describe("readNavLayout（真实 API 读取 + 异常兜底）", () => {
  afterEach(() => {
    delete (globalThis as { uni?: unknown }).uni;
  });

  it("getMenuButtonBoundingClientRect 返回正常值时采用实测值", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => IPHONE_X_MENU,
      getSystemInfoSync: () => ({
        statusBarHeight: IPHONE_X_STATUS,
        windowWidth: 375,
      }),
    };
    const layout = readNavLayout();
    expect(layout.fallback).toBe(false);
    expect(layout.navBarHeight).toBe(40);
    expect(layout.totalHeight).toBe(84);
  });

  it("接口抛错 → 走兜底而不是崩溃", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => {
        throw new Error("not supported");
      },
      getSystemInfoSync: () => {
        throw new Error("not supported");
      },
    };
    const layout = readNavLayout();
    expect(layout.fallback).toBe(true);
    expect(layout.totalHeight).toBe(DEFAULT_NAV_TOTAL_HEIGHT);
  });

  it("uni 全局不存在 → 兜底 44+32", () => {
    const layout = readNavLayout();
    expect(layout.fallback).toBe(true);
    expect(layout.navBarHeight).toBe(44);
    expect(layout.statusBarHeight).toBe(32);
  });

  it("接口返回 null（部分基础库）→ 兜底", () => {
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: () => null as never,
      getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375 }),
    };
    const layout = readNavLayout();
    expect(layout.fallback).toBe(true);
    expect(layout.navBarHeight).toBe(44);
    expect(layout.statusBarHeight).toBe(20);
  });

  it("读取失败不产生未处理异常（vi.spyOn 监控）", () => {
    const throwing = vi.fn(() => {
      throw new Error("boom");
    });
    (globalThis as { uni?: unknown }).uni = {
      getMenuButtonBoundingClientRect: throwing,
      getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    };
    expect(() => readNavLayout()).not.toThrow();
    expect(throwing).toHaveBeenCalledTimes(1);
  });
});
