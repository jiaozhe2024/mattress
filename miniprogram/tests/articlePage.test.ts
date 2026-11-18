// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { WxArticleDetail, WxArticleSummary } from "@/types/home";

const loadOptions = vi.hoisted(() => ({ value: {} as Record<string, string> }));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (callback: (options: Record<string, string>) => void) => {
    callback(loadOptions.value);
  },
}));

vi.mock("@/api/content", () => ({
  getArticles: vi.fn(),
  getArticle: vi.fn(),
}));

import { getArticle, getArticles } from "@/api/content";
import ArticleListPage from "@/pages/article/list.vue";
import ArticleDetailPage from "@/pages/article/detail.vue";

const mockGetArticles = getArticles as unknown as ReturnType<typeof vi.fn>;
const mockGetArticle = getArticle as unknown as ReturnType<typeof vi.fn>;

const ARTICLES: WxArticleSummary[] = [
  {
    id: 1,
    title: "乐卡思资讯：2026 春季睡眠节开幕",
    category: "news",
    cover: null,
    create_time: "2026-11-15T08:00:00",
  },
  {
    id: 2,
    title: "门店服务升级公告",
    category: "news",
    cover: "/uploads/images/news-2.png",
    create_time: "2026-11-10T08:00:00",
  },
];

const DETAIL: WxArticleDetail = {
  ...ARTICLES[0],
  content: "<p>正文内容</p>",
};

function uniStub(): Record<string, unknown> {
  return {
    getMenuButtonBoundingClientRect: () => ({
      top: 48,
      bottom: 80,
      left: 281,
      right: 368,
      width: 87,
      height: 32,
    }),
    getSystemInfoSync: () => ({ statusBarHeight: 44, windowWidth: 375 }),
    navigateTo: vi.fn(),
    navigateBack: vi.fn(),
    switchTab: vi.fn(),
    reLaunch: vi.fn(),
    showToast: vi.fn(),
  };
}

beforeEach(() => {
  loadOptions.value = {};
  (globalThis as { uni?: unknown }).uni = uniStub();
  mockGetArticles.mockResolvedValue({
    items: ARTICLES,
    total: ARTICLES.length,
    page: 1,
    size: 20,
  });
  mockGetArticle.mockResolvedValue(DETAIL);
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  vi.clearAllMocks();
});

describe("资讯列表页导航（回归：custom 导航必须自绘标题栏）", () => {
  it("渲染二级页导航：标题「品牌资讯」+ 返回按钮", async () => {
    const wrapper = mount(ArticleListPage);
    await flushPromises();

    expect(wrapper.find(".wnav").exists()).toBe(true);
    expect(wrapper.find(".wnav-title").text()).toBe("品牌资讯");
    expect(wrapper.find(".wnav-back").exists()).toBe(true);
    expect(wrapper.find(".icon--chevron-left").exists()).toBe(true);
    expect(wrapper.find(".wnav-brand").exists()).toBe(false);
  });

  it("导航在正文之前，正文不再顶到状态栏下", async () => {
    const wrapper = mount(ArticleListPage);
    await flushPromises();

    const html = wrapper.html();
    expect(html.indexOf("wnav")).toBeLessThan(html.indexOf("class=\"body\""));
  });

  it("列表按接口数据渲染标题与日期", async () => {
    const wrapper = mount(ArticleListPage);
    await flushPromises();

    expect(wrapper.findAll(".row")).toHaveLength(2);
    expect(wrapper.findAll(".row-title").map((el) => el.text())).toEqual(
      ARTICLES.map((article) => article.title)
    );
    expect(wrapper.findAll(".row-date").map((el) => el.text())).toEqual([
      "2026-11-15",
      "2026-11-10",
    ]);
  });

  it("点击条目跳转详情页", async () => {
    const wrapper = mount(ArticleListPage);
    await flushPromises();

    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } })
      .uni;
    await wrapper.findAll(".row")[1].trigger("tap");
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/article/detail?id=2" })
    );
  });
});

describe("资讯详情页导航（回归：custom 导航必须自绘标题栏）", () => {
  it("渲染二级页导航：标题「资讯详情」+ 返回按钮", async () => {
    loadOptions.value = { id: "1" };
    const wrapper = mount(ArticleDetailPage);
    await flushPromises();

    expect(wrapper.find(".wnav").exists()).toBe(true);
    expect(wrapper.find(".wnav-title").text()).toBe("资讯详情");
    expect(wrapper.find(".wnav-back").exists()).toBe(true);
    expect(wrapper.find(".wnav-brand").exists()).toBe(false);
  });

  it("详情加载失败时导航仍存在（错误态不遮挡返回）", async () => {
    loadOptions.value = { id: "1" };
    mockGetArticle.mockRejectedValue(new Error("500"));
    const wrapper = mount(ArticleDetailPage);
    await flushPromises();

    expect(wrapper.find(".wnav").exists()).toBe(true);
    expect(wrapper.text()).toContain("资讯不存在或已下线");
  });
});
