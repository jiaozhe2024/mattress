// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { WxCategory } from "@/types/home";
import type { WxProductListItem, WxProductPage } from "@/types/product";

const hoisted = vi.hoisted(() => ({ loadOptions: {} as Record<string, unknown> }));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (callback: (options: Record<string, unknown>) => void) => {
    callback(hoisted.loadOptions);
  },
  onShow: (callback: () => void) => {
    callback();
  },
  onUnload: () => {
    /* 卸载清理在本测试无副作用 */
  },
}));

vi.mock("@/api/product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/product")>();
  return {
    ...actual,
    getCategories: vi.fn(),
    getProducts: vi.fn(),
  };
});

import { getCategories, getProducts } from "@/api/product";
import ProductListPage from "@/pages/product/list.vue";

const mockGetCategories = getCategories as unknown as ReturnType<typeof vi.fn>;
const mockGetProducts = getProducts as unknown as ReturnType<typeof vi.fn>;

function makeCategory(id: number, name: string): WxCategory {
  return { id, name, subtitle: "", icon: null, banner_image: null, sort: id };
}

const CATEGORIES: WxCategory[] = [
  makeCategory(1, "6S专属床垫"),
  makeCategory(2, "手工 · 零胶虑"),
];

const PRODUCT_NAMES = [
  "3D床垫",
  "幸福3号",
  "幸福2号",
  "幸福1号",
  "幸福99床垫",
  "505压缩卷包床垫",
  "323特制版床垫",
  "9M 卷绵特制床垫",
];

const PRODUCTS: WxProductListItem[] = PRODUCT_NAMES.map((name, index) => ({
  id: index + 1,
  category_id: index + 1,
  category_name: CATEGORIES[index % CATEGORIES.length].name,
  name,
  model: `M-${index + 1}`,
  slogan: null,
  spec: "1800 × 2000 mm",
  sleep_feel: "舒适睡感",
  main_image: `/uploads/p${index + 1}.png`,
  sort: index,
}));

function makePage(items: WxProductListItem[], total = items.length): WxProductPage {
  return { items, total, page: 1, size: 10 };
}

function uniStub(): Record<string, unknown> {
  const storage = new Map<string, string>();
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
    getStorageSync: (key: string) => storage.get(key) ?? "",
    setStorageSync: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeStorageSync: (key: string) => {
      storage.delete(key);
    },
    navigateTo: vi.fn(),
    navigateBack: vi.fn(),
    switchTab: vi.fn(),
    reLaunch: vi.fn(),
    showToast: vi.fn(),
    setNavigationBarTitle: vi.fn(),
  };
}

async function mountPage(options: Record<string, unknown> = {}): Promise<ReturnType<typeof mount>> {
  hoisted.loadOptions = options;
  const wrapper = mount(ProductListPage);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  (globalThis as { uni?: unknown }).uni = uniStub();
  mockGetCategories.mockResolvedValue(CATEGORIES);
  mockGetProducts.mockResolvedValue(makePage(PRODUCTS));
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("产品页 V3 结构（spec.md §5.3 + Q5/Q6/Q12）", () => {
  // 产品列表页已改为原生导航栏（pages.json 去 navigationStyle:custom），
  // 标题由 uni.setNavigationBarTitle 下发，页面内不再有 .wnav-* 自绘节点。
  function lastNavTitle(): string | undefined {
    const uni = (globalThis as unknown as {
      uni: { setNavigationBarTitle: ReturnType<typeof vi.fn> };
    }).uni;
    const calls = uni.setNavigationBarTitle.mock.calls;
    return calls.length === 0 ? undefined : (calls[calls.length - 1][0] as { title: string }).title;
  }

  it("原生导航栏标题取自 category_id 对应的分类名", async () => {
    await mountPage({ category_id: "2" });
    expect(lastNavTitle()).toBe("手工 · 零胶虑");
  });

  it("分类接口失败时标题回退 query.category_name", async () => {
    mockGetCategories.mockRejectedValue(new Error("500"));
    await mountPage({
      category_id: "99",
      category_name: "薄垫 · 不薄待",
    });
    expect(lastNavTitle()).toBe("薄垫 · 不薄待");
  });

  it("无任何分类信息时标题兜底「产品」", async () => {
    await mountPage({});
    expect(lastNavTitle()).toBe("产品");
  });

  it("搜索框占位文案逐字为「请输入搜索的商品」", async () => {
    const wrapper = await mountPage({});
    const input = wrapper.find(".pl-search-input");
    expect(input.attributes("placeholder")).toBe("请输入搜索的商品");
    expect(wrapper.find(".pl-search-icon .icon--search").exists()).toBe(true);
  });

  it("排序三项存在，默认「综合」为选中态且带 28×3 指示条", async () => {
    const wrapper = await mountPage({});
    const tabs = wrapper.findAll(".pl-sort-tab");
    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.find(".pl-sort-tab-text").text())).toEqual([
      "综合",
      "推荐",
      "新品",
    ]);
    const active = wrapper.find(".pl-sort-tab--active");
    expect(active.find(".pl-sort-tab-text").text()).toBe("综合");
    expect(active.find(".pl-sort-indicator").exists()).toBe(true);
    expect(wrapper.findAll(".pl-sort-indicator")).toHaveLength(1);
  });

  it("产品卡两列网格，8 张卡，规格与「舒适睡感」标签齐全", async () => {
    const wrapper = await mountPage({});
    expect(wrapper.find(".pl-grid").exists()).toBe(true);
    const cards = wrapper.findAll(".pcard");
    expect(cards).toHaveLength(8);
    expect(wrapper.findAll(".pl-card")).toHaveLength(8);
    expect(wrapper.findAll(".pcard-spec")[0].text()).toBe("1800 × 2000 mm");
    expect(wrapper.findAll(".pcard-feel-text")[0].text()).toBe("舒适睡感");
    expect(wrapper.findAll(".pcard-detail-text")[0].text()).toBe("查看详情");
  });

  it("搜索框右侧 list 图标 22×22 可点（Q6 延后仍网格）", async () => {
    const wrapper = await mountPage({});
    const toggle = wrapper.find(".pl-view-toggle");
    expect(toggle.exists()).toBe(true);
    expect(toggle.find(".icon--list").exists()).toBe(true);
    const uni = (globalThis as { uni: { showToast: ReturnType<typeof vi.fn> } }).uni;
    await toggle.trigger("tap");
    expect(uni.showToast).toHaveBeenCalled();
    // 仍为网格，不产出列表视图
    expect(wrapper.find(".pl-grid").exists()).toBe(true);
    expect(wrapper.find(".pl-cards--list").exists()).toBe(false);
  });

  it("底部 TabBar 为 two（首页 / 返回）", async () => {
    const wrapper = await mountPage({});
    expect(wrapper.find(".tabbar--two").exists()).toBe(true);
    const items = wrapper.findAll(".tabbar-item");
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.find(".tabbar-label").text())).toEqual([
      "首页",
      "返回",
    ]);
  });

  it("已移除：左侧分类侧边导航 / 底部已选栏 / 列表视图 / 版本条", async () => {
    const wrapper = await mountPage({});
    expect(wrapper.find(".pl-side").exists()).toBe(false);
    expect(wrapper.find(".pl-side-item").exists()).toBe(false);
    expect(wrapper.find(".sel-bar").exists()).toBe(false);
    expect(wrapper.find(".pl-cards--list").exists()).toBe(false);
    expect(wrapper.find(".version-bar").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("参考复刻优化版");
  });
});

describe("产品页交互", () => {
  it("点卡片 → navigateTo 产品详情并带 id", async () => {
    const wrapper = await mountPage({});
    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } }).uni;
    await wrapper.findAll(".pcard")[2].trigger("tap");
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/product/detail?id=3" })
    );
  });

  it("详情页未落地（navigateTo fail）→ toast 兜底，不留死链", async () => {
    const navigateTo = vi.fn((options: { fail?: () => void }) => options.fail?.());
    (globalThis as { uni?: unknown }).uni = {
      ...uniStub(),
      navigateTo,
      showToast: vi.fn(),
    };
    const wrapper = await mountPage({});
    const uni = (globalThis as { uni: { showToast: ReturnType<typeof vi.fn> } }).uni;
    await wrapper.findAll(".pcard")[0].trigger("tap");
    expect(navigateTo).toHaveBeenCalledTimes(1);
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "产品详情页建设中" })
    );
  });

  it("搜索输入 300ms 防抖后按关键词重新请求并写入历史", async () => {
    vi.useFakeTimers();
    const wrapper = await mountPage({});
    mockGetProducts.mockClear();

    const input = wrapper.find(".pl-search-input");
    await input.trigger("input", { detail: { value: "卷绵" } });
    expect(mockGetProducts).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    await flushPromises();

    expect(mockGetProducts).toHaveBeenCalledTimes(1);
    const query = mockGetProducts.mock.calls[0][0] as Record<string, unknown>;
    expect(query.keyword).toBe("卷绵");
    expect(
      (globalThis as { uni: { getStorageSync: (key: string) => string } }).uni.getStorageSync(
        "product_search_history"
      )
    ).toContain("卷绵");
  });

  it("点排序「新品」→ 按 sort=newest 重新请求", async () => {
    const wrapper = await mountPage({});
    mockGetProducts.mockClear();
    await wrapper.findAll(".pl-sort-tab")[2].trigger("tap");
    await flushPromises();
    const query = mockGetProducts.mock.calls[0][0] as Record<string, unknown>;
    expect(query.sort).toBe("newest");
  });
});

describe("产品页四态", () => {
  it("加载中 → 显示加载态", async () => {
    let resolvePage!: (value: WxProductPage) => void;
    mockGetProducts.mockReturnValue(
      new Promise<WxProductPage>((resolve) => {
        resolvePage = resolve;
      })
    );
    const wrapper = await mountPage({});
    expect(wrapper.text()).toContain("加载中…");
    resolvePage(makePage(PRODUCTS));
    await flushPromises();
  });

  it("接口失败 → 错误态 + 重试入口", async () => {
    mockGetProducts.mockRejectedValue(new Error("500"));
    const wrapper = await mountPage({});
    expect(wrapper.text()).toContain("产品列表加载失败");
    expect(wrapper.find(".pl-state-retry").exists()).toBe(true);
  });

  it("空列表 → 空态提示", async () => {
    mockGetProducts.mockResolvedValue(makePage([]));
    const wrapper = await mountPage({});
    expect(wrapper.text()).toContain("该分类下暂无产品");
    expect(wrapper.findAll(".pcard")).toHaveLength(0);
  });

  it("有数据 → 网格渲染（ready 态）", async () => {
    const wrapper = await mountPage({});
    expect(wrapper.findAll(".pcard")).toHaveLength(8);
  });
});
