// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { WxBanner, WxCategory, WxHome } from "@/types/home";

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (callback: () => void) => {
    callback();
  },
}));

vi.mock("@/api/content", () => ({
  getHome: vi.fn(),
}));

vi.mock("@/api/product", () => ({
  getCategories: vi.fn(),
}));

import { getHome } from "@/api/content";
import { getCategories } from "@/api/product";
import HomePage from "@/pages/index/index.vue";
import { useProductFilterStore } from "@/stores/useProductFilterStore";

const mockGetHome = getHome as unknown as ReturnType<typeof vi.fn>;
const mockGetCategories = getCategories as unknown as ReturnType<typeof vi.fn>;

function makeCategory(id: number, sort: number, overrides: Partial<WxCategory> = {}): WxCategory {
  return {
    id,
    name: `系列${id}`,
    subtitle: `副文案${id}`,
    icon: null,
    banner_image: null,
    sort,
    ...overrides,
  };
}

const CATEGORIES: WxCategory[] = [
  makeCategory(1, 1, { name: "6S专属床垫", subtitle: "六大专属 分龄深睡" }),
  makeCategory(2, 2, { name: "手工 · 零胶虑", subtitle: "大师手作 奢睡体验" }),
  makeCategory(3, 3, { name: "姜大师 · 草本", subtitle: "暖姜纤维 古法温养" }),
  makeCategory(4, 4, { name: "双面控", subtitle: "冷暖可调 软硬可调" }),
  makeCategory(5, 5, { name: "零压 · 深睡", subtitle: "睡眠无压力" }),
  makeCategory(6, 6, { name: "“卷”起来", subtitle: "爱上卷包床垫" }),
  makeCategory(7, 7, { name: "次卧 · 不次等", subtitle: "小空间也讲究" }),
  makeCategory(8, 8, { name: "薄垫 · 不薄待", subtitle: "厚度降低 睡感加分" }),
];

const BANNERS: WxBanner[] = [
  { id: 11, image: "/uploads/b1.png", jump_type: 1, jump_value: null, sort: 1 },
  { id: 12, image: "/uploads/b2.png", jump_type: 2, jump_value: "3", sort: 2 },
];

function makeHome(banners: WxBanner[] = BANNERS): WxHome {
  return { banners, categories: CATEGORIES, services: [] };
}

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
    switchTab: vi.fn(),
    navigateTo: vi.fn(),
    showToast: vi.fn(),
  };
}

async function mountHome(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(HomePage);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  (globalThis as { uni?: unknown }).uni = uniStub();
  mockGetHome.mockResolvedValue(makeHome());
  mockGetCategories.mockResolvedValue(CATEGORIES);
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  vi.clearAllMocks();
});

describe("首页 V3 结构（spec.md §5.1 + Q14/Q15）", () => {
  it("渲染品牌主视觉卡：品牌行 + 两行标题 + 副标题 + 轮播", async () => {
    const wrapper = await mountHome();
    expect(wrapper.find(".home-hero").exists()).toBe(true);
    expect(wrapper.find(".home-hero-brand").text()).toBe("LEKASI 乐卡思");
    expect(wrapper.findAll(".home-hero-title").map((el) => el.text())).toEqual([
      "把舒适，",
      "带回每一个夜晚",
    ]);
    expect(wrapper.find(".home-hero-subtitle").text()).toBe(
      "探索适合自己与家人的好眠选择"
    );
    expect(wrapper.find(".home-hero-swiper").exists()).toBe(true);
    expect(wrapper.findAll(".home-hero-slide")).toHaveLength(BANNERS.length);
  });

  it("轮播指示点数量随 banners 动态，首点激活（16×4 条）", async () => {
    const wrapper = await mountHome();
    expect(wrapper.findAll(".home-hero-dot")).toHaveLength(2);
    expect(wrapper.findAll(".home-hero-dot--active")).toHaveLength(1);
    expect(wrapper.findAll(".home-hero-dot")[0].classes()).toContain(
      "home-hero-dot--active"
    );
  });

  it("仅 1 张 banner 时隐藏指示点", async () => {
    mockGetHome.mockResolvedValue(makeHome([BANNERS[0]]));
    const wrapper = await mountHome();
    expect(wrapper.findAll(".home-hero-slide")).toHaveLength(1);
    expect(wrapper.find(".home-hero-indicator").exists()).toBe(false);
  });

  it("banners 为空时主视觉卡退化为静态文案卡（无 swiper、无图片区）", async () => {
    mockGetHome.mockResolvedValue(makeHome([]));
    const wrapper = await mountHome();
    expect(wrapper.find(".home-hero-text").exists()).toBe(true);
    expect(wrapper.find(".home-hero-swiper").exists()).toBe(false);
  });

  it("系列卡取前 4 条，标题与副文案非空（banner_image 为 null 走文字通道）", async () => {
    const wrapper = await mountHome();
    const cards = wrapper.findAll(".home-series-card");
    expect(cards).toHaveLength(4);
    expect(wrapper.findAll(".home-series-title").map((el) => el.text())).toEqual([
      "6S专属床垫",
      "手工 · 零胶虑",
      "姜大师 · 草本",
      "双面控",
    ]);
    const subtitles = wrapper
      .findAll(".home-series-subtitle")
      .map((el) => el.text());
    expect(subtitles).toHaveLength(4);
    subtitles.forEach((text) => expect(text.trim()).not.toBe(""));
    expect(wrapper.findAll(".home-series-image")).toHaveLength(0);
  });

  it("banner_image 非空时渲染整块图片，不再渲染文字层", async () => {
    mockGetCategories.mockResolvedValue([
      makeCategory(1, 1, { banner_image: "/uploads/series-1.png" }),
      makeCategory(2, 2),
    ]);
    const wrapper = await mountHome();
    expect(wrapper.findAll(".home-series-image")).toHaveLength(1);
    expect(wrapper.findAll(".home-series-title")).toHaveLength(1);
  });

  it("寝具入口 3 个：型号 + 名称", async () => {
    const wrapper = await mountHome();
    const cards = wrapper.findAll(".home-bedding-card");
    expect(cards).toHaveLength(3);
    expect(wrapper.findAll(".home-bedding-model").map((el) => el.text())).toEqual([
      "9B",
      "9D",
      "9P",
    ]);
    expect(wrapper.findAll(".home-bedding-name").map((el) => el.text())).toEqual([
      "特制软床",
      "抗菌软床",
      "助眠枕头",
    ]);
  });

  it("好眠服务：标题 + 3 张卡（标题/说明）", async () => {
    const wrapper = await mountHome();
    expect(wrapper.find(".home-services-title").text()).toBe("乐卡思 · 好眠服务");
    expect(wrapper.findAll(".home-service-card")).toHaveLength(3);
    expect(wrapper.findAll(".home-service-title").map((el) => el.text())).toEqual([
      "产品认识",
      "睡眠小课堂",
      "到店体验",
    ]);
    expect(
      wrapper.findAll(".home-service-caption").map((el) => el.text())
    ).toEqual(["了解面料与结构", "找到适合的睡感", "亲自感受舒适"]);
  });

  it("快捷入口 2 个：乐卡思资讯 / 联系客服", async () => {
    const wrapper = await mountHome();
    expect(wrapper.findAll(".home-entry-card")).toHaveLength(2);
    expect(wrapper.findAll(".home-entry-label").map((el) => el.text())).toEqual([
      "乐卡思资讯",
      "联系客服",
    ]);
  });

  it("不含旧 V2 结构：7 分类宫格 / 服务横滚 / 「更多系列」", async () => {
    const wrapper = await mountHome();
    expect(wrapper.find(".category-grid").exists()).toBe(false);
    expect(wrapper.find(".category-cell").exists()).toBe(false);
    expect(wrapper.find(".category-more").exists()).toBe(false);
    expect(wrapper.find(".service-scroll").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("更多系列");
  });

  it("不含版本标识条（Q12）", async () => {
    const wrapper = await mountHome();
    expect(wrapper.text()).not.toContain("参考复刻优化版");
  });

  it("首页挂载选款 FAB（胶囊，.select-fab）", async () => {
    const wrapper = await mountHome();
    expect(wrapper.find(".select-fab").exists()).toBe(true);
    expect(wrapper.find(".select-fab-label").text()).toBe("选款");
  });
});

describe("首页交互", () => {
  it("点系列卡：Pinia 写分类 + switchTab 产品 tab", async () => {
    const wrapper = await mountHome();
    const uni = (globalThis as { uni: { switchTab: ReturnType<typeof vi.fn> } }).uni;
    await wrapper.findAll(".home-series-card")[1].trigger("tap");
    const store = useProductFilterStore();
    expect(store.requestedCategoryId).toBe(2);
    expect(store.requestedKeyword).toBeNull();
    expect(uni.switchTab).toHaveBeenCalledWith({ url: "/pages/product/category" });
  });

  it("点寝具卡(9B)：Pinia 写 keyword=9B + switchTab 产品 tab（不是分类）", async () => {
    const wrapper = await mountHome();
    await wrapper.findAll(".home-bedding-card")[0].trigger("tap");
    const store = useProductFilterStore();
    expect(store.requestedKeyword).toBe("9B");
    expect(store.requestedCategoryId).toBeNull();
  });

  it("点「乐卡思资讯」跳已建资讯列表页（不弹 toast）", async () => {
    const wrapper = await mountHome();
    const uni = (globalThis as {
      uni: { navigateTo: ReturnType<typeof vi.fn>; showToast: ReturnType<typeof vi.fn> };
    }).uni;
    await wrapper.findAll(".home-entry-card")[0].trigger("tap");
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: "/pages/article/list" });
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it("点「联系客服」调用 wx.openCustomerServiceChat；失败兜底 toast", async () => {
    const openCustomerServiceChat = vi.fn(
      (options: { fail?: () => void }) => options.fail?.()
    );
    (globalThis as { uni?: unknown }).uni = {
      ...uniStub(),
      openCustomerServiceChat,
      showToast: vi.fn(),
    };
    const wrapper = await mountHome();
    const uni = (globalThis as {
      uni: { showToast: ReturnType<typeof vi.fn> };
    }).uni;
    await wrapper.findAll(".home-entry-card")[1].trigger("tap");
    expect(openCustomerServiceChat).toHaveBeenCalledTimes(1);
    expect(openCustomerServiceChat.mock.calls[0][0]).toMatchObject({
      corpId: expect.any(String),
      extInfo: { url: expect.any(String) },
    });
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "客服暂不可用，请稍后再试" })
    );
  });
});

describe("首页三态", () => {
  it("两接口全失败 → 错误态 + 重试入口", async () => {
    mockGetHome.mockRejectedValue(new Error("500"));
    mockGetCategories.mockRejectedValue(new Error("500"));
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain("首页内容加载失败");
    expect(wrapper.find(".home-state-retry").exists()).toBe(true);
  });

  it("home 失败但分类成功 → 仍渲染正文（banners 空、系列卡降级无图）", async () => {
    mockGetHome.mockRejectedValue(new Error("500"));
    const wrapper = await mountHome();
    expect(wrapper.find(".home-body").exists()).toBe(true);
    expect(wrapper.find(".home-hero-swiper").exists()).toBe(false);
    expect(wrapper.findAll(".home-series-card")).toHaveLength(4);
  });

  it("两接口均成功但无 banner 无分类 → 空态提示", async () => {
    mockGetHome.mockResolvedValue({ banners: [], categories: [], services: [] });
    mockGetCategories.mockResolvedValue([]);
    const wrapper = await mountHome();
    expect(wrapper.text()).toContain("暂无内容");
  });
});
