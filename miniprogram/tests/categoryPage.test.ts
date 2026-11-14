// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { WxCategory } from "@/types/home";

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (callback: () => void) => {
    callback();
  },
  onShow: (callback: () => void) => {
    callback();
  },
}));

vi.mock("@/api/product", () => ({
  getCategories: vi.fn(),
}));

import { getCategories } from "@/api/product";
import CategoryPage from "@/pages/product/category.vue";
import { useProductFilterStore } from "@/stores/useProductFilterStore";

const mockGetCategories = getCategories as unknown as ReturnType<typeof vi.fn>;

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

const CATEGORIES: WxCategory[] = [
  makeCategory(1, 1, { name: "6S专属床垫", subtitle: "六大专属　分龄深睡" }),
  makeCategory(2, 2, { name: "手工 · 零胶虑", subtitle: "大师手作　奢睡体验" }),
  makeCategory(3, 3, { name: "姜大师 · 草本", subtitle: "暖姜纤维　古法温养" }),
  makeCategory(4, 4, { name: "双面控", subtitle: "冷暖可调　软硬可调" }),
  makeCategory(5, 5, { name: "零压 · 深睡", subtitle: "睡眠无压力" }),
  makeCategory(6, 6, { name: "“卷”起来", subtitle: "爱上卷包床垫" }),
  makeCategory(7, 7, { name: "次卧 · 不次等", subtitle: "卧室就要睡好觉" }),
  makeCategory(8, 8, { name: "薄垫 · 不薄待", subtitle: "厚度降低　睡感加分" }),
];

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
    switchTab: vi.fn(),
    showToast: vi.fn(),
  };
}

async function mountCategory(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(CategoryPage);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  (globalThis as { uni?: unknown }).uni = uniStub();
  mockGetCategories.mockResolvedValue(CATEGORIES);
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  vi.clearAllMocks();
});

describe("产品分类页 V3 结构（spec.md §5.2 + Q12/Q15）", () => {
  it("渲染系列横幅：品牌行 + 标题 + 副标题 + 展示图", async () => {
    const wrapper = await mountCategory();
    expect(wrapper.find(".pc-banner").exists()).toBe(true);
    expect(wrapper.find(".pc-banner-brand").text()).toBe("LEKASI 乐卡思");
    expect(wrapper.find(".pc-banner-title").text()).toBe("9M 特制床垫");
    expect(wrapper.find(".pc-banner-subtitle").text()).toBe(
      "让每一次休息，都更舒适"
    );
    expect(wrapper.find(".pc-banner-image").attributes("src")).toBe(
      "/static/category/banner-mattress.png"
    );
  });

  it("分类入口数 = 后端 8 条，标题与副文案均非空且按 sort 顺序", async () => {
    const wrapper = await mountCategory();
    const entries = wrapper.findAll(".pc-entry");
    expect(entries).toHaveLength(8);
    expect(wrapper.findAll(".pc-entry-title").map((el) => el.text())).toEqual(
      CATEGORIES.map((category) => category.name)
    );
    for (const subtitle of wrapper.findAll(".pc-entry-subtitle")) {
      expect(subtitle.text().trim().length).toBeGreaterThan(0);
    }
  });

  it("每条入口右侧有 chevron-right 20×20 图标", async () => {
    const wrapper = await mountCategory();
    expect(wrapper.findAll(".icon--chevron-right")).toHaveLength(8);
  });

  it("banner_image 为空走文字通道：标题 + subtitle（不出图片）", async () => {
    const wrapper = await mountCategory();
    expect(wrapper.findAll(".pc-entry-image")).toHaveLength(0);
    expect(wrapper.find(".pc-entry-title").text()).toBe("6S专属床垫");
    expect(wrapper.find(".pc-entry-subtitle").text()).toBe(
      "六大专属　分龄深睡"
    );
  });

  it("banner_image 非空优先渲染整块图片（不出文字层）", async () => {
    mockGetCategories.mockResolvedValue([
      makeCategory(1, 1, { banner_image: "/uploads/images/cat-6s.png" }),
      makeCategory(2, 2),
    ]);
    const wrapper = await mountCategory();
    const first = wrapper.findAll(".pc-entry")[0];
    expect(first.find(".pc-entry-image").exists()).toBe(true);
    expect(first.find(".pc-entry-title").exists()).toBe(false);
    expect(wrapper.findAll(".pc-entry")[1].find(".pc-entry-title").exists()).toBe(
      true
    );
  });

  it("点击第 1 个分类 → navigateTo 产品列表并带该分类 id", async () => {
    const wrapper = await mountCategory();
    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } })
      .uni;
    await wrapper.findAll(".pc-entry")[0].trigger("tap");
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/pages/product/list?category_id=1",
      })
    );
  });

  it("点击第 8 个分类 → category_id=8（分类 id 与所点项一致）", async () => {
    const wrapper = await mountCategory();
    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } })
      .uni;
    await wrapper.findAll(".pc-entry")[7].trigger("tap");
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/pages/product/list?category_id=8",
      })
    );
  });

  it("不实现版本标识条（Q12）", async () => {
    const wrapper = await mountCategory();
    expect(wrapper.find(".version-bar").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("参考复刻优化版");
  });

  it("挂载选款 FAB（胶囊 64×42）", async () => {
    const wrapper = await mountCategory();
    expect(wrapper.find(".select-fab").exists()).toBe(true);
    expect(wrapper.find(".select-fab-label").text()).toBe("选款");
  });

  it("底部 TabBar 由原生 custom-tab-bar 渲染（本页不自绘 three variant）", async () => {
    const wrapper = await mountCategory();
    expect(wrapper.find(".tabbar").exists()).toBe(false);
  });
});

describe("产品分类页三态与降级", () => {
  it("分类接口失败 → 错误态 + 重试入口", async () => {
    mockGetCategories.mockRejectedValue(new Error("500"));
    const wrapper = await mountCategory();
    expect(wrapper.text()).toContain("分类加载失败");
    expect(wrapper.find(".pc-state-retry").exists()).toBe(true);
  });

  it("空分类 → 空态提示", async () => {
    mockGetCategories.mockResolvedValue([]);
    const wrapper = await mountCategory();
    expect(wrapper.text()).toContain("暂无分类");
  });

  it("图片加载失败 → 该入口降级为文字", async () => {
    mockGetCategories.mockResolvedValue([
      makeCategory(1, 1, { banner_image: "/bad.png" }),
    ]);
    const wrapper = await mountCategory();
    expect(wrapper.find(".pc-entry-image").exists()).toBe(true);
    await wrapper.find(".pc-entry-image").trigger("error");
    expect(wrapper.find(".pc-entry-image").exists()).toBe(false);
    expect(wrapper.find(".pc-entry-title").text()).toBe("分类1");
  });
});

describe("产品分类页兼容桥（首页 Pinia 请求 → 产品列表页）", () => {
  it("无待处理请求时不跳转", async () => {
    const wrapper = await mountCategory();
    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } })
      .uni;
    await wrapper.vm.$nextTick();
    expect(uni.navigateTo).not.toHaveBeenCalled();
  });

  it("Pinia 有待处理分类 → navigateTo 产品列表带 category_id", async () => {
    const store = useProductFilterStore();
    store.requestCategory(3);
    const wrapper = await mountCategory();
    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } })
      .uni;
    await wrapper.vm.$nextTick();
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/pages/product/list?category_id=3",
      })
    );
  });

  it("Pinia 有待处理关键词 → navigateTo 产品列表（关键词由目标页 onShow 消费）", async () => {
    const store = useProductFilterStore();
    store.requestKeyword("9B");
    const wrapper = await mountCategory();
    const uni = (globalThis as { uni: { navigateTo: ReturnType<typeof vi.fn> } })
      .uni;
    await wrapper.vm.$nextTick();
    expect(uni.navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: "/pages/product/list" })
    );
  });
});
