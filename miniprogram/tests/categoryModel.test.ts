import { describe, expect, it } from "vitest";
import {
  CATEGORY_BANNER,
  CATEGORY_CHEVRON_COLOR,
  categoryEntryViewsOf,
  productListUrlOf,
} from "@/components/category/categoryModel";
import type { WxCategory } from "@/types/home";

function makeCategory(id: number, sort: number, overrides: Partial<WxCategory> = {}): WxCategory {
  return {
    id,
    name: `分类${id}`,
    subtitle: `副文案${id}`,
    icon: null,
    banner_image: null,
    sort,
    ...overrides,
  };
}

const EIGHT: WxCategory[] = [
  makeCategory(1, 1, { name: "6S专属床垫", subtitle: "六大专属　分龄深睡" }),
  makeCategory(2, 2, { name: "手工 · 零胶虑", subtitle: "大师手作　奢睡体验" }),
  makeCategory(3, 3, { name: "姜大师 · 草本", subtitle: "暖姜纤维　古法温养" }),
  makeCategory(4, 4, { name: "双面控", subtitle: "冷暖可调　软硬可调" }),
  makeCategory(5, 5, { name: "零压 · 深睡", subtitle: "睡眠无压力" }),
  makeCategory(6, 6, { name: "“卷”起来", subtitle: "爱上卷包床垫" }),
  makeCategory(7, 7, { name: "次卧 · 不次等", subtitle: "卧室就要睡好觉" }),
  makeCategory(8, 8, { name: "薄垫 · 不薄待", subtitle: "厚度降低　睡感加分" }),
];

describe("CATEGORY_BANNER（spec.md §5.2 ①）", () => {
  it("文案逐字对齐设计稿", () => {
    expect(CATEGORY_BANNER.brand).toBe("LEKASI 乐卡思");
    expect(CATEGORY_BANNER.title).toBe("9M 特制床垫");
    expect(CATEGORY_BANNER.subtitle).toBe("让每一次休息，都更舒适");
  });

  it("横幅展示图为本地静态资源（不依赖后端 uploads）", () => {
    expect(CATEGORY_BANNER.image).toBe("/static/category/banner-mattress.png");
  });
});

describe("categoryEntryViewsOf（Q15 双通道 + 排序）", () => {
  it("按 sort 升序输出，保留全部 8 项", () => {
    const views = categoryEntryViewsOf([...EIGHT].reverse());
    expect(views).toHaveLength(8);
    expect(views.map((view) => view.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("banner_image 为空 → 文字通道：name + subtitle", () => {
    const views = categoryEntryViewsOf(EIGHT);
    expect(views[0]).toMatchObject({
      id: 1,
      title: "6S专属床垫",
      subtitle: "六大专属　分龄深睡",
      imageSrc: null,
    });
  });

  it("banner_image 非空 → 图片通道（保留文字字段供降级）", () => {
    const views = categoryEntryViewsOf([
      makeCategory(1, 1, { banner_image: "/uploads/images/cat-6s.png" }),
    ]);
    expect(views[0].imageSrc).toBe("/uploads/images/cat-6s.png");
    expect(views[0].title).toBe("分类1");
    expect(views[0].subtitle).toBe("副文案1");
  });

  it("banner_image 为空白字符串按空处理（走文字通道）", () => {
    const views = categoryEntryViewsOf([
      makeCategory(1, 1, { banner_image: "   " }),
    ]);
    expect(views[0].imageSrc).toBeNull();
  });

  it("图片加载失败 → 该条降级为文字，其余不受影响", () => {
    const views = categoryEntryViewsOf(
      [
        makeCategory(1, 1, { banner_image: "/a.png" }),
        makeCategory(2, 2, { banner_image: "/b.png" }),
      ],
      [1]
    );
    expect(views[0].imageSrc).toBeNull();
    expect(views[1].imageSrc).toBe("/b.png");
  });

  it("subtitle 为 null 时输出空字符串（模板据此隐藏副文案）", () => {
    const views = categoryEntryViewsOf([
      makeCategory(1, 1, { subtitle: null }),
    ]);
    expect(views[0].subtitle).toBe("");
  });

  it("不修改入参（不可变）", () => {
    const input = [...EIGHT].reverse();
    const snapshot = JSON.parse(JSON.stringify(input));
    categoryEntryViewsOf(input);
    expect(input).toEqual(snapshot);
  });
});

describe("productListUrlOf（spec.md §5.2 ③）", () => {
  it("带 category_id 指向产品列表页", () => {
    expect(productListUrlOf(1)).toBe("/pages/product/list?category_id=1");
    expect(productListUrlOf(8)).toBe("/pages/product/list?category_id=8");
  });
});

describe("CATEGORY_CHEVRON_COLOR", () => {
  it("镜像 tokens.scss $color-navy-50", () => {
    expect(CATEGORY_CHEVRON_COLOR).toBe("#8890b8");
  });
});
