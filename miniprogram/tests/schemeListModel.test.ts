import { describe, expect, it } from "vitest";
import type { WxSchemeListItem } from "@/api/scheme";
import {
  formatSchemeDate,
  metaLineOf,
  schemeCardViewsOf,
  titleLineOf,
} from "@/components/scheme/schemeListModel";

describe("formatSchemeDate（Q9：日期动态格式化 YYYY.MM.DD）", () => {
  it("格式化为 YYYY.MM.DD", () => {
    expect(formatSchemeDate("2026-11-15T14:14:06")).toBe("2026.11.15");
  });

  it("只给日期部分也能处理", () => {
    expect(formatSchemeDate("2026-11-15")).toBe("2026.11.15");
  });

  it("带时区的 ISO 串取日期部分", () => {
    expect(formatSchemeDate("2026-11-15T14:14:06+08:00")).toBe("2026.11.15");
    expect(formatSchemeDate("2026-11-15T23:59:59Z")).toBe("2026.11.15");
  });

  it("个位数月份日期补零", () => {
    expect(formatSchemeDate("2026-01-05T00:00:00")).toBe("2026.01.05");
  });

  it("斜杠格式兜底解析", () => {
    expect(formatSchemeDate("2026/03/09")).toBe("2026.03.09");
  });

  it("null / undefined / 空串返回空串", () => {
    expect(formatSchemeDate(null)).toBe("");
    expect(formatSchemeDate(undefined)).toBe("");
    expect(formatSchemeDate("")).toBe("");
    expect(formatSchemeDate("   ")).toBe("");
  });

  it("非法字符串返回空串而非抛错", () => {
    expect(formatSchemeDate("不是日期")).toBe("");
  });

  it("绝不返回硬编码日期（Q9）", () => {
    // 防回归：任何输入都不应产生设计稿里的示例日期 2026.11.04
    expect(formatSchemeDate("2025-01-01T00:00:00")).toBe("2025.01.01");
    expect(formatSchemeDate("")).not.toBe("2026.11.04");
  });
});

describe("titleLineOf / metaLineOf", () => {
  it("副行1 前缀「标题：」", () => {
    expect(titleLineOf("主卧方案")).toBe("标题：主卧方案");
  });

  it("副行2 含产品数量与日期", () => {
    expect(metaLineOf(2, "2026-11-15T14:14:06")).toBe("产品数量：2 / 日期：2026.11.15");
  });

  it("日期缺失时只显示产品数量", () => {
    expect(metaLineOf(3, null)).toBe("产品数量：3");
  });

  it("产品数量非法值归零", () => {
    expect(metaLineOf(Number.NaN, null)).toBe("产品数量：0");
    expect(metaLineOf(-1, null)).toBe("产品数量：0");
    expect(metaLineOf(2.7, null)).toBe("产品数量：2");
  });
});

describe("schemeCardViewsOf（列表项 → 卡片视图）", () => {
  const base: WxSchemeListItem = {
    id: 1,
    title: "主卧舒适好眠方案",
    remark: null,
    product_count: 2,
    share_count: 0,
    cover_image: "/uploads/demo/a.jpg",
    create_time: "2026-11-15T14:14:06",
  };

  it("映射标题/副行/封面", () => {
    const [card] = schemeCardViewsOf([base]);
    expect(card.id).toBe(1);
    expect(card.title).toBe("主卧舒适好眠方案");
    expect(card.titleLine).toBe("标题：主卧舒适好眠方案");
    expect(card.metaLine).toBe("产品数量：2 / 日期：2026.11.15");
    expect(card.coverImage).toBe("/uploads/demo/a.jpg");
  });

  it("cover_image 为空串时置 null（页面走占位层）", () => {
    const [card] = schemeCardViewsOf([{ ...base, cover_image: "" }]);
    expect(card.coverImage).toBeNull();
  });

  it("cover_image 为 null 时置 null", () => {
    const [card] = schemeCardViewsOf([{ ...base, cover_image: null }]);
    expect(card.coverImage).toBeNull();
  });

  it("cover_image 含空白时 trim 后判空", () => {
    const [card] = schemeCardViewsOf([{ ...base, cover_image: "   " }]);
    expect(card.coverImage).toBeNull();
  });

  it("空列表返回空数组", () => {
    expect(schemeCardViewsOf([])).toEqual([]);
  });

  it("多条目顺序保持", () => {
    const cards = schemeCardViewsOf([
      base,
      { ...base, id: 2, title: "给家人的床垫推荐" },
    ]);
    expect(cards.map((c) => c.id)).toEqual([1, 2]);
    expect(cards[1].title).toBe("给家人的床垫推荐");
  });
});
