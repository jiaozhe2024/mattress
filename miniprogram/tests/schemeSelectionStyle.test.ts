import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 选品页样式/注册静态约束（MP-05A）
 *
 * 守住 4 条硬约束（前几轮返工点）：
 *   - 无硬编码 hex、无裸 px 间距、无裸 px 行高（一律走 tokens.scss）
 *   - Q10：右栏卡宽由容器 calc 决定，禁止 126.92px
 *   - Q11：字号为整数（10/8/8），禁止 9.88/7.6
 *   - Q13：操作钮透明热区 ≥44×44
 */
const MP_ROOT = path.resolve(__dirname, "..");
const SRC = path.join(MP_ROOT, "src");
const PAGE = readFileSync(
  path.join(SRC, "pages", "scheme", "selection.vue"),
  "utf8"
);
const PAGES_JSON = JSON.parse(
  readFileSync(path.join(SRC, "pages.json"), "utf8")
) as { pages: Array<{ path: string; style?: Record<string, string> }> };
const CONFIG = readFileSync(path.join(SRC, "config.ts"), "utf8");

function styleOf(source: string): string {
  const match = source.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (!match) throw new Error("未找到 <style> 块");
  return match[1];
}

/** 去掉 CSS 注释：注释可自由引用原稿中间值（如「Q10：不硬编码 126.92px」），
 * 约束只针对实际声明。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

const STYLE = stripComments(styleOf(PAGE));

describe("选品页样式 token 合规", () => {
  it("无硬编码 hex 色值（颜色一律引用 $color-*）", () => {
    expect(STYLE.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });

  it("无裸 px 间距（gap/padding/margin 一律引用 $space-*）", () => {
    const bare = STYLE.match(/(?:gap|padding|margin)[^:;]*:\s*[^;]*?\b\d+px/g) ?? [];
    expect(bare).toEqual([]);
  });

  it("无裸 px 行高（一律引用 $line-height-*）", () => {
    expect(STYLE.match(/line-height:\s*\d+px/g) ?? []).toEqual([]);
  });

  it("无 JS 端硬编码色值（icon/占位色镜像 token 除外）", () => {
    // 页面 script 仅允许 SEARCH_ICON_COLOR / SEARCH_PLACEHOLDER_STYLE 这两处镜像
    expect(PAGE).toContain('const SEARCH_ICON_COLOR = "#8a90a3";');
    expect(STYLE).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe("Q10：右栏产品卡宽度自适应", () => {
  it("卡宽走容器 calc((100% - gap) / 2)，两列", () => {
    expect(STYLE).toContain("width: calc((100% - #{$space-8}) / 2);");
  });

  it("源码不出现 126.92 硬编码宽度（声明层面）", () => {
    expect(STYLE).not.toContain("126.92");
  });

  it("右栏容器 flex:1 + min-width:0，左栏固定 94", () => {
    expect(STYLE).toMatch(/\.ss-cats\s*\{[\s\S]*?width:\s*94px;/);
    expect(STYLE).toMatch(/\.ss-products\s*\{[\s\S]*?flex:\s*1;/);
  });
});

describe("Q11：字号取整", () => {
  it("产品名 10px、规格/标签 8px，全为整数", () => {
    expect(STYLE).toMatch(/\.ss-card-name\s*\{[\s\S]*?font-size:\s*\$font-10;/);
    // 规格与两个标签均 8px
    expect(STYLE.match(/font-size:\s*8px;/g) ?? []).toHaveLength(3);
  });

  it("不出现 9.88 / 7.6 / 8.36 / 21.28 等原稿中间值（声明层面）", () => {
    const declarations = stripComments(styleOf(PAGE));
    expect(declarations).not.toMatch(/9\.88|7\.6\b|8\.36|21\.28|10\.64|3\.04/);
  });
});

describe("Q13：操作钮透明热区 ≥44×44", () => {
  it("热区容器 44×44，视觉按钮 21×21 嵌套", () => {
    expect(STYLE).toMatch(
      /\.ss-card-action\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/
    );
    expect(STYLE).toMatch(
      /\.ss-card-action-btn\s*\{[\s\S]*?width:\s*21px;[\s\S]*?height:\s*21px;/
    );
  });
});

describe("spec §5.6 关键尺寸", () => {
  it("搜索框 327×36 圆角 18，图标 16×16 left14 top10", () => {
    expect(STYLE).toMatch(
      /\.ss-search-box\s*\{[\s\S]*?width:\s*327px;[\s\S]*?height:\s*36px;[\s\S]*?border-radius:\s*\$radius-18;/
    );
    expect(STYLE).toMatch(
      /\.ss-search-icon\s*\{[\s\S]*?top:\s*\$space-10;[\s\S]*?left:\s*14px;[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/
    );
  });

  it("分类项 h56 px8、指示条 3×16 top20、激活项白底", () => {
    expect(STYLE).toMatch(
      /\.ss-cat-item\s*\{[\s\S]*?height:\s*56px;[\s\S]*?padding:\s*0 \$space-8;/
    );
    expect(STYLE).toMatch(
      /\.ss-cat-indicator\s*\{[\s\S]*?top:\s*\$space-20;[\s\S]*?width:\s*3px;[\s\S]*?height:\s*16px;[\s\S]*?background-color:\s*\$color-yellow;/
    );
    expect(STYLE).toMatch(
      /\.ss-cat-item--active\s*\{[\s\S]*?background-color:\s*\$color-text-inv;/
    );
  });

  it("产品卡圆角 12 + shadow/card、主图高 114、内容区 left9 top119", () => {
    expect(STYLE).toMatch(
      /\.ss-card\s*\{[\s\S]*?border-radius:\s*\$radius-12;[\s\S]*?box-shadow:\s*\$shadow-card;/
    );
    expect(STYLE).toMatch(/\.ss-card-media\s*\{[\s\S]*?height:\s*114px;/);
    expect(STYLE).toMatch(
      /\.ss-card-info\s*\{[\s\S]*?top:\s*119px;[\s\S]*?left:\s*\$space-9;/
    );
  });

  it("睡感标签圆角 8 yellowSoft，查看详情圆角 3 fill", () => {
    expect(STYLE).toMatch(
      /\.ss-card-feel\s*\{[\s\S]*?border-radius:\s*\$radius-8;[\s\S]*?background-color:\s*\$color-yellow-soft;/
    );
    expect(STYLE).toMatch(
      /\.ss-card-detail\s*\{[\s\S]*?border-radius:\s*3px;[\s\S]*?background-color:\s*\$color-fill;/
    );
  });

  it("操作钮：未选 yellow + navy，已选 line + text3", () => {
    expect(STYLE).toMatch(
      /\.ss-card-action-btn\s*\{[\s\S]*?border-radius:\s*\$radius-11;[\s\S]*?background-color:\s*\$color-yellow;/
    );
    expect(STYLE).toMatch(
      /\.ss-card-action--selected \.ss-card-action-btn\s*\{[\s\S]*?background-color:\s*\$color-line;/
    );
    expect(STYLE).toMatch(
      /\.ss-card-action--selected \.ss-card-action-icon\s*\{[\s\S]*?color:\s*\$color-text-3;/
    );
  });

  it("已选栏 bg navy p12 gap10；OK 90×42 圆角 20；缩略图 49×55 / 图 49×38", () => {
    expect(STYLE).toMatch(
      /\.ss-selected-bar\s*\{[\s\S]*?gap:\s*\$space-10;[\s\S]*?padding:\s*\$space-12;[\s\S]*?background-color:\s*\$color-navy;/
    );
    expect(STYLE).toMatch(
      /\.ss-ok\s*\{[\s\S]*?width:\s*90px;[\s\S]*?height:\s*42px;[\s\S]*?border-radius:\s*\$radius-20;/
    );
    expect(STYLE).toMatch(
      /\.ss-thumb\s*\{[\s\S]*?width:\s*49px;[\s\S]*?height:\s*55px;[\s\S]*?border-radius:\s*\$radius-4;[\s\S]*?background-color:\s*\$color-cream;/
    );
    expect(STYLE).toMatch(
      /\.ss-thumb-image\s*\{[\s\S]*?width:\s*49px;[\s\S]*?height:\s*38px;/
    );
  });
});

describe("Q12：不实现版本标识条", () => {
  it("无版本条标记", () => {
    expect(PAGE).not.toContain("参考复刻优化版");
    expect(PAGE).not.toMatch(/version-bar/);
  });
});

describe("页面注册与目标路由", () => {
  it("pages.json 注册 pages/scheme/selection，标题「LEKASI 乐卡思」且用原生导航栏", () => {
    const entry = PAGES_JSON.pages.find(
      (page) => page.path === "pages/scheme/selection"
    );
    expect(entry).toBeDefined();
    expect(entry?.style?.navigationStyle).toBeUndefined();
    expect(entry?.style?.navigationBarTitleText).toBe("LEKASI 乐卡思");
  });

  it("config.SELECTION_PAGE 指向真实选品页", () => {
    expect(CONFIG).toContain('export const SELECTION_PAGE = "/pages/scheme/selection";');
  });

  it("页面复用 Icon，并走 useSelectionStore（核心约定 9）", () => {
    expect(PAGE).toContain("<Icon");
    expect(PAGE).toContain("useSelectionStore");
    expect(PAGE).not.toContain("setStorageSync");
  });
});
