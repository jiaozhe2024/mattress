// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { WxArticleDetail, WxArticleSummary } from "@/types/home";

const SRC = path.resolve(__dirname, "..", "src");
const LIST_PAGE_PATH = path.join(SRC, "pages", "article", "list.vue");
const DETAIL_PAGE_PATH = path.join(SRC, "pages", "article", "detail.vue");

/** 读 pages.json 中某页的 style（原生导航栏的标题/返回唯一真值源）。 */
function pagesJsonEntry(pagePath: string): {
  path: string;
  style?: Record<string, unknown>;
} {
  const json = JSON.parse(readFileSync(path.join(SRC, "pages.json"), "utf8")) as {
    pages: Array<{ path: string; style?: Record<string, unknown> }>;
  };
  const entry = json.pages.find((page) => page.path === pagePath);
  if (!entry) throw new Error(`pages.json 未注册页面 ${pagePath}`);
  return entry;
}

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

describe("资讯列表页导航（回归：改用原生导航栏后标题由 pages.json 下发）", () => {
  it("pages.json 注册「品牌资讯」标题且不再自定义导航", async () => {
    const entry = pagesJsonEntry("pages/article/list");
    expect(entry.style?.navigationBarTitleText).toBe("品牌资讯");
    expect(entry.style?.navigationStyle).toBeUndefined();
    expect(readFileSync(LIST_PAGE_PATH, "utf8")).not.toContain("WechatNav");
  });

  it("页面不再自绘导航栏（无 .wnav 节点，正文由原生导航栏托底）", async () => {
    const wrapper = mount(ArticleListPage);
    await flushPromises();

    expect(wrapper.find(".wnav").exists()).toBe(false);
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

describe("资讯详情页导航（回归：改用原生导航栏后标题由 pages.json 下发）", () => {
  it("pages.json 注册「资讯详情」标题且不再自定义导航", async () => {
    const entry = pagesJsonEntry("pages/article/detail");
    expect(entry.style?.navigationBarTitleText).toBe("资讯详情");
    expect(entry.style?.navigationStyle).toBeUndefined();
    expect(readFileSync(DETAIL_PAGE_PATH, "utf8")).not.toContain("WechatNav");
  });

  it("详情页不再自绘导航栏", async () => {
    loadOptions.value = { id: "1" };
    const wrapper = mount(ArticleDetailPage);
    await flushPromises();

    expect(wrapper.find(".wnav").exists()).toBe(false);
  });

  it("详情加载失败时页面仍可见错误提示（错误态不遮挡返回按钮外的内容）", async () => {
    loadOptions.value = { id: "1" };
    mockGetArticle.mockRejectedValue(new Error("500"));
    const wrapper = mount(ArticleDetailPage);
    await flushPromises();

    expect(wrapper.text()).toContain("资讯不存在或已下线");
  });
});
