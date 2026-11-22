import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { WxSchemeProduct } from "@/api/scheme";
import {
  PREVIEW_FOOTNOTE,
  PREVIEW_SPEC_PREFIX,
  PREVIEW_SPEC_SUFFIX,
  previewSharePathOf,
  previewShareTitleOf,
  previewViewsOf,
} from "@/components/scheme/schemePreviewModel";

const previewPage = readFileSync(path.resolve(__dirname, "../src/pages/scheme/preview.vue"), "utf8");

it("立即分享使用微信原生分享按钮，不显示引导提示", () => {
  expect(previewPage).toMatch(/<button\b[^>]*class="sp-action sp-action--primary"[^>]*open-type="share"/);
  expect(previewPage).not.toContain("请点击右上角");
});

it("底部按钮按容器宽度自适应", () => {
  expect(previewPage).toMatch(/\.sp-action\s*\{[^}]*flex:\s*1/);
  expect(previewPage).not.toMatch(/\.sp-action(?:--secondary|--primary)?\s*\{[^}]*(?:width|height):\s*\d+px/);
});

function row(
  sort: number,
  snapshot: Record<string, unknown>,
  id = sort + 1
): WxSchemeProduct {
  return { id, product_id: Number(snapshot.id ?? id), sort, snapshot };
}

describe("previewViewsOf（快照 → 海报视图，核心约定 10 读快照）", () => {
  it("映射名称/卖点/主图/规格行", () => {
    const views = previewViewsOf([
      row(0, {
        id: 1,
        name: "卷绵2号净护款",
        slogan: "睡感适中 · 面料亲肤",
        main_image: "/uploads/demo/a.jpg",
        spec: "1800 × 2000 mm",
      }),
    ]);
    expect(views[0].name).toBe("卷绵2号净护款");
    expect(views[0].sellingPoint).toBe("睡感适中 · 面料亲肤");
    expect(views[0].mainImage).toBe("/uploads/demo/a.jpg");
    expect(views[0].specLine).toBe(
      `${PREVIEW_SPEC_PREFIX}1800 × 2000 mm${PREVIEW_SPEC_SUFFIX}`
    );
  });

  it("按 sort 升序排列（后端已排序，此处防御性再排）", () => {
    const views = previewViewsOf([
      row(2, { id: 3, name: "C" }, 30),
      row(0, { id: 1, name: "A" }, 10),
      row(1, { id: 2, name: "B" }, 20),
    ]);
    expect(views.map((v) => v.name)).toEqual(["A", "B", "C"]);
  });

  it("快照缺 id 时用 snapshot-{index} 兜底保证 key 唯一", () => {
    const views = previewViewsOf([
      row(0, { name: "无 id 产品" }),
      row(1, { name: "也无 id" }),
    ]);
    expect(views[0].key).toBe("snapshot-0");
    expect(views[1].key).toBe("snapshot-1");
    expect(views[0].key).not.toBe(views[1].key);
  });

  it("spec 为空时不生成规格行（不出现 `规格： · 实际配置` 这种残缺文案）", () => {
    const views = previewViewsOf([row(0, { id: 1, name: "X" })]);
    expect(views[0].specLine).toBe("");
  });

  it("字段缺失时给空串，不抛错", () => {
    const views = previewViewsOf([row(0, {})]);
    expect(views[0].name).toBe("");
    expect(views[0].sellingPoint).toBe("");
    expect(views[0].mainImage).toBe("");
    expect(views[0].specLine).toBe("");
  });

  it("空列表返回空数组", () => {
    expect(previewViewsOf([])).toEqual([]);
  });

  it("snapshot 为 null 时不崩", () => {
    const views = previewViewsOf([
      { id: 1, product_id: 1, sort: 0, snapshot: null as unknown as Record<string, unknown> },
    ]);
    expect(views[0].name).toBe("");
  });
});

describe("previewSharePathOf / previewShareTitleOf（分享卡片）", () => {
  it("分享路径带 id，走 public 只读", () => {
    expect(previewSharePathOf(7)).toBe("/pages/scheme/preview?id=7");
  });

  it("标题原样返回（不超 30 字）", () => {
    expect(previewShareTitleOf("给家人的床垫推荐")).toBe("给家人的床垫推荐");
  });

  it("超长标题截断并加省略号", () => {
    // 明确构造 40 字，确保越过 30 字阈值（不能靠估算中文长度）
    const long = "一".repeat(40);
    expect(long.length).toBe(40);
    const out = previewShareTitleOf(long);
    expect(out).toBe(`${"一".repeat(30)}…`);
    expect(out.length).toBe(31);
  });

  it("恰好 30 字不截断（边界）", () => {
    const exact = "二".repeat(30);
    expect(previewShareTitleOf(exact)).toBe(exact);
  });

  it("31 字开始截断（边界）", () => {
    const over = "三".repeat(31);
    expect(previewShareTitleOf(over)).toBe(`${"三".repeat(30)}…`);
  });

  it("空标题回落底注文案", () => {
    expect(previewShareTitleOf("")).toBe(PREVIEW_FOOTNOTE);
    expect(previewShareTitleOf("   ")).toBe(PREVIEW_FOOTNOTE);
  });

  it("标题首尾空白被清理", () => {
    expect(previewShareTitleOf("  主卧方案  ")).toBe("主卧方案");
  });
});
