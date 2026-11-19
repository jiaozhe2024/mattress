import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * tokens 完整性与 design-tokens.md 逐项比对。
 * tokens.scss 是唯一真值；本测试锁定它不被悄悄改错/漏项。
 */
const MP_ROOT = path.resolve(__dirname, "..");
const TOKENS_FILE = path.join(MP_ROOT, "src", "styles", "tokens.scss");
const TOKENS_DOC = path.resolve(
  MP_ROOT,
  "..",
  "docs",
  "design",
  "design-spec",
  "design-tokens.md"
);

const source = readFileSync(TOKENS_FILE, "utf8");

function scssValue(name: string): string | undefined {
  const match = source.match(new RegExp(`^\\$${name}:\\s*([^;]+);`, "m"));
  return match ? match[1].trim() : undefined;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** design-tokens.md §颜色 —— 已登记变量 + 硬编码实测值。 */
const COLORS: Array<[string, string]> = [
  ["color-navy", "#1a2260"],
  ["color-navy-soft", "#e7eaf6"],
  ["color-navy-50", "#8890b8"],
  ["color-yellow", "#f7c400"],
  ["color-yellow-bg", "#fff8e1"],
  ["color-cream", "#fdfbf5"],
  ["color-text-1", "#1e2330"],
  ["color-text-2", "#4a5165"],
  ["color-text-3", "#8a90a3"],
  ["color-text-inv", "#ffffff"],
  ["color-line", "#e9ecf2"],
  ["color-fill", "#f4f6fa"],
  ["color-yellow-soft", "#fff3c4"],
  ["color-yellow-deep", "#6b4e00"],
  ["color-navy-deep", "#111639"],
];

const RADII: Array<[string, string]> = [
  ["radius-2", "2px"],
  ["radius-4", "4px"],
  ["radius-6", "6px"],
  ["radius-8", "8px"],
  ["radius-11", "11px"],
  ["radius-12", "12px"],
  ["radius-16", "16px"],
  ["radius-18", "18px"],
  ["radius-20", "20px"],
  ["radius-26", "26px"],
  ["radius-pill", "999px"],
];

const FONT_SIZES: Array<[string, string]> = [
  ["font-31", "31px"],
  ["font-30", "30px"],
  ["font-28", "28px"],
  ["font-27", "27px"],
  ["font-23", "23px"],
  ["font-21", "21px"],
  ["font-19", "19px"],
  ["font-18", "18px"],
  ["font-17", "17px"],
  ["font-15", "15px"],
  ["font-14", "14px"],
  ["font-13", "13px"],
  ["font-12", "12px"],
  ["font-11", "11px"],
  ["font-10", "10px"],
  ["font-9", "9px"],
];

const SPACES: Array<[string, string]> = [
  ["space-4", "4px"],
  ["space-8", "8px"],
  ["space-12", "12px"],
  ["space-16", "16px"],
  ["space-24", "24px"],
  ["space-32", "32px"],
];

/** 结构尺寸（design-tokens.md §全局结构尺寸）。 */
const STRUCTURE: Array<[string, string]> = [
  ["nav-title-height", "44px"],
  ["nav-padding-x", "16px"],
  ["capsule-width", "76px"],
  ["capsule-height", "28px"],
  ["nav-total-height", "76px"],
  ["tabbar-height", "58px"],
  ["tabbar-padding-x", "28px"],
  ["tabbar-item-width", "64px"],
  ["tabbar-item-gap", "3px"],
  ["tabbar-icon-size", "24px"],
  ["tabbar-label-size", "10px"],
  ["status-bar-height", "32px"],
  ["version-bar-height", "24px"],
];

describe("tokens.scss 完整性（与 design-tokens.md 逐项一致）", () => {
  it("设计文档可作为比对基准存在", () => {
    expect(existsSync(TOKENS_DOC)).toBe(true);
  });

  it.each(COLORS)("颜色 $%s = %s 且为合法 6 位 hex", (name, expected) => {
    const value = scssValue(name);
    expect(value, `缺少 $${name}`).toBeDefined();
    expect(value).toBe(expected);
    expect(value).toMatch(HEX_RE);
  });

  it("仅允许 design-tokens.md 中出现的 15 个颜色 token（无自定义色）", () => {
    const declared = [...source.matchAll(/^\$(color-[a-z0-9-]+):/gm)].map(
      (m) => m[1]
    );
    expect(new Set(declared)).toEqual(new Set(COLORS.map(([name]) => name)));
  });

  it("投影与文档一致", () => {
    expect(scssValue("shadow-card")).toBe(
      "0 4px 8px rgba(26, 34, 96, 0.06)"
    );
    expect(scssValue("shadow-fab")).toBe("0 6px 8px rgba(26, 34, 96, 0.25)");
  });

  it.each(RADII)("圆角 $%s = %s", (name, expected) => {
    expect(scssValue(name)).toBe(expected);
  });

  it.each(FONT_SIZES)("字号 $%s = %s", (name, expected) => {
    expect(scssValue(name)).toBe(expected);
  });

  it("字号阶梯恰好 16 档（31/30/28/27/23/21/19/18/17/15/14/13/12/11/10/9）", () => {
    const declared = [...source.matchAll(/^\$font-(\d+):/gm)].map((m) => m[1]);
    expect(declared.map(Number).sort((a, b) => b - a)).toEqual([
      31, 30, 28, 27, 23, 21, 19, 18, 17, 15, 14, 13, 12, 11, 10, 9,
    ]);
  });

  it("每档字号都有对应行高 token", () => {
    for (const [name] of FONT_SIZES) {
      const size = name.replace("font-", "");
      expect(scssValue(`line-height-${size}`), `缺少 $line-height-${size}`)
        .toBeDefined();
    }
    expect(scssValue("line-height-30")).toBe("1.25");
    expect(scssValue("line-height-15-fixed")).toBe("22px");
    expect(scssValue("line-height-14-fixed")).toBe("20px");
    expect(scssValue("line-height-13-fixed")).toBe("19px");
  });

  it.each(SPACES)("间距 $%s = %s", (name, expected) => {
    expect(scssValue(name)).toBe(expected);
  });

  it.each(STRUCTURE)("结构尺寸 $%s = %s", (name, expected) => {
    expect(scssValue(name)).toBe(expected);
  });

  it("导出全量 CSS 自定义属性（每个 SCSS 颜色/圆角/字号/间距都有同名变量）", () => {
    const declared = [...source.matchAll(/^\$([a-z0-9-]+):/gm)].map((m) => m[1]);
    const cssVars = new Set(
      [...source.matchAll(/^\s+--([a-z0-9-]+):/gm)].map((m) => m[1])
    );
    const missing = declared.filter(
      (name) =>
        !name.startsWith("font-family") &&
        !name.startsWith("font-weight") &&
        !cssVars.has(name)
    );
    expect(missing).toEqual([]);
  });

  it("px2rpx 函数按 750 设计宽换算（1px = 2rpx）", () => {
    const out = execFileSync(
      path.join(MP_ROOT, "node_modules", ".bin", "sass"),
      ["--stdin", "--no-source-map"],
      {
        cwd: MP_ROOT,
        input: `@import "./src/styles/tokens.scss";\n.a{width:px2rpx(16);}`,
        encoding: "utf8",
      }
    );
    expect(out).toContain("width: 32rpx");
  });
});
