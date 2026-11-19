import { describe, it, expect } from "vitest";
import {
  BEDDING_ENTRIES,
  HOME_SERVICE_LIMIT,
  HOME_SERVICE_TITLE,
  QUICK_ENTRIES,
  SERIES_CARD_LIMIT,
  bannerIndicatorCount,
  seriesCardViewsOf,
  seriesCardsOf,
  serviceCardViewsOf,
} from "@/components/home/homeModel";
import type { WxArticleSummary, WxCategory } from "@/types/home";

function makeCategory(
  id: number,
  overrides: Partial<WxCategory> = {}
): WxCategory {
  return {
    id,
    name: `分类${id}`,
    subtitle: `副文案${id}`,
    icon: null,
    banner_image: null,
    sort: id,
    ...overrides,
  };
}

describe("homeModel 静态内容（spec.md §5.1）", () => {
  it("系列卡最多 4 条", () => {
    expect(SERIES_CARD_LIMIT).toBe(4);
  });

  it("寝具入口固定 3 条且型号/名称为 9B/9D/9P", () => {
    expect(BEDDING_ENTRIES.map((entry) => entry.model)).toEqual([
      "9B",
      "9D",
      "9P",
    ]);
    expect(BEDDING_ENTRIES.map((entry) => entry.name)).toEqual([
      "特制软床",
      "抗菌软床",
      "助眠枕头",
    ]);
  });

  it("好眠服务区块标题固定", () => {
    expect(HOME_SERVICE_TITLE).toBe("乐卡思 · 好眠服务");
    expect(HOME_SERVICE_LIMIT).toBe(3);
  });

  it("快捷入口 2 项：资讯（newspaper）/ 客服（message-circle）", () => {
    expect(QUICK_ENTRIES.map((entry) => entry.key)).toEqual([
      "news",
      "contact",
    ]);
    expect(QUICK_ENTRIES.map((entry) => entry.label)).toEqual([
      "乐卡思资讯",
      "联系客服",
    ]);
    expect(QUICK_ENTRIES.map((entry) => entry.icon)).toEqual([
      "newspaper",
      "message-circle",
    ]);
  });
});

describe("seriesCardsOf（Q15：8 分类取 sort 前 4）", () => {
  it("按 sort 升序取前 4 条，不改动入参", () => {
    const input = [
      makeCategory(5, { sort: 5 }),
      makeCategory(1, { sort: 1 }),
      makeCategory(3, { sort: 3 }),
      makeCategory(2, { sort: 2 }),
      makeCategory(4, { sort: 4 }),
    ];
    const snapshot = input.map((item) => item.id);
    expect(seriesCardsOf(input).map((item) => item.id)).toEqual([1, 2, 3, 4]);
    expect(input.map((item) => item.id)).toEqual(snapshot);
  });

  it("sort 相同时按 id 升序稳定排序", () => {
    const input = [
      makeCategory(9, { sort: 1 }),
      makeCategory(7, { sort: 1 }),
      makeCategory(8, { sort: 1 }),
    ];
    expect(seriesCardsOf(input, 2).map((item) => item.id)).toEqual([7, 8]);
  });

  it("不足 4 条时返回全部；limit=0 / 非有限值返回空数组", () => {
    expect(seriesCardsOf([makeCategory(1)])).toHaveLength(1);
    expect(seriesCardsOf([makeCategory(1)], 0)).toEqual([]);
    expect(seriesCardsOf([makeCategory(1)], Number.NaN)).toEqual([]);
  });
});

describe("seriesCardViewsOf（banner_image 优先，文字降级）", () => {
  it("banner_image 非空 → 走图片通道", () => {
    const views = seriesCardViewsOf([
      makeCategory(1, { banner_image: "/uploads/c1.png" }),
    ]);
    expect(views[0].imageSrc).toBe("/uploads/c1.png");
  });

  it("banner_image 为 null / 空串 / 纯空格 → 走文字通道，subtitle 去空格", () => {
    const views = seriesCardViewsOf([
      makeCategory(1, { banner_image: null }),
      makeCategory(2, { banner_image: "" }),
      makeCategory(3, { banner_image: "   " }),
      makeCategory(4, { subtitle: "  六大专属 分龄深睡  " }),
    ]);
    expect(views.map((view) => view.imageSrc)).toEqual([null, null, null, null]);
    expect(views[3].subtitle).toBe("六大专属 分龄深睡");
  });

  it("图片加载失败（failedIds）自动降级为文字", () => {
    const views = seriesCardViewsOf(
      [makeCategory(1, { banner_image: "/uploads/c1.png" })],
      [1]
    );
    expect(views[0].imageSrc).toBeNull();
    expect(views[0].title).toBe("分类1");
  });

  it("subtitle 为 null 时归一为空串（模板按非空渲染）", () => {
    const views = seriesCardViewsOf([makeCategory(1, { subtitle: null })]);
    expect(views[0].subtitle).toBe("");
  });
});

describe("serviceCardViewsOf（/wxapi/home services 前 3 条，cover 图片降级）", () => {
  function makeService(
    id: number,
    overrides: Partial<WxArticleSummary> = {}
  ): WxArticleSummary {
    return {
      id,
      title: `服务${id}`,
      category: "service",
      cover: null,
      create_time: null,
      ...overrides,
    };
  }

  it("按后端顺序取前 3 条，保留标题", () => {
    const views = serviceCardViewsOf([
      makeService(1, { title: "产品认识" }),
      makeService(2, { title: "睡眠小课堂" }),
      makeService(3, { title: "到店体验" }),
      makeService(4, { title: "多余" }),
    ]);
    expect(views.map((view) => view.title)).toEqual([
      "产品认识",
      "睡眠小课堂",
      "到店体验",
    ]);
  });

  it("cover 非空 → 图片通道；null/空串/纯空格 → imageSrc=null", () => {
    const views = serviceCardViewsOf([
      makeService(1, { cover: "/uploads/a.png" }),
      makeService(2, { cover: null }),
      makeService(3, { cover: "   " }),
    ]);
    expect(views.map((view) => view.imageSrc)).toEqual([
      "/uploads/a.png",
      null,
      null,
    ]);
  });

  it("图片加载失败（failedIds）降级为占位", () => {
    const views = serviceCardViewsOf(
      [makeService(1, { cover: "/uploads/a.png" })],
      [1]
    );
    expect(views[0].imageSrc).toBeNull();
    expect(views[0].title).toBe("服务1");
  });

  it("空数组 / limit=0 / 非有限值返回空数组", () => {
    expect(serviceCardViewsOf([])).toEqual([]);
    expect(serviceCardViewsOf([makeService(1)], [], 0)).toEqual([]);
    expect(serviceCardViewsOf([makeService(1)], [], Number.NaN)).toEqual([]);
  });
});

describe("bannerIndicatorCount（Q14：仅 1 张时隐藏指示点）", () => {  it.each([
    [0, 0],
    [1, 0],
    [2, 2],
    [4, 4],
  ])("banners=%i → 指示点 %i 个", (count, expected) => {
    expect(bannerIndicatorCount(count)).toBe(expected);
  });

  it("异常输入（NaN / 负数）返回 0", () => {
    expect(bannerIndicatorCount(Number.NaN)).toBe(0);
    expect(bannerIndicatorCount(-3)).toBe(0);
  });
});
