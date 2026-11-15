// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { WxProductDetail } from "@/components/product/productDetailModel";

const hoisted = vi.hoisted(() => ({
  loadOptions: {} as Record<string, unknown>,
  shareHandler: null as null | (() => Record<string, unknown>),
}));

vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (callback: (options: Record<string, unknown>) => void) => {
    callback(hoisted.loadOptions);
  },
  onShareAppMessage: (
    callback: () => Record<string, unknown>
  ): void => {
    hoisted.shareHandler = callback;
  },
}));

vi.mock("@/api/product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/product")>();
  return {
    ...actual,
    getProductDetail: vi.fn(),
  };
});

import { getProductDetail } from "@/api/product";
import { useSelectionStore } from "@/stores/useSelectionStore";
import ProductDetailPage from "@/pages/product/detail.vue";

const mockGetDetail = getProductDetail as unknown as ReturnType<typeof vi.fn>;

function makeDetail(overrides: Partial<WxProductDetail> = {}): WxProductDetail {
  return {
    id: 1,
    category_id: 1,
    category_name: "6S专属床垫",
    name: "卷绵薄垫万能款",
    model: "JM-BD-06",
    slogan: "6cm 薄垫 · 轻盈舒适",
    spec: "1800 × 2000 mm",
    sleep_feel: "细腻面料　｜　分层支撑　｜　简洁设计",
    main_image: "/uploads/demo/product-3d-main.jpg",
    sort: 1,
    detail_images: [
      "/uploads/demo/product-3d-detail-1.jpg",
      "/uploads/demo/product-3d-detail-2.jpg",
    ],
    real_images: [
      "/uploads/demo/product-3d-real-1.jpg",
      "/uploads/demo/product-3d-real-2.jpg",
    ],
    detail_content: "<p>六大专属，分龄深睡</p>",
    create_time: null,
    ...overrides,
  };
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
  };
}

async function mountPage(
  options: Record<string, unknown> = { id: "1" }
): Promise<ReturnType<typeof mount>> {
  hoisted.loadOptions = options;
  const wrapper = mount(ProductDetailPage);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  (globalThis as { uni?: unknown }).uni = uniStub();
  hoisted.shareHandler = null;
  mockGetDetail.mockResolvedValue(makeDetail());
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  vi.clearAllMocks();
});

describe("产品详情页 V3 结构（spec.md §5.4）", () => {
  it("二级页导航：返回箭头 + 标题 LEKASI 乐卡思", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".wnav-back").exists()).toBe(true);
    expect(wrapper.find(".wnav-title").text()).toBe("LEKASI 乐卡思");
  });

  it("海报区：品牌行 + 产品名 23 + 副标", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".pd-poster").exists()).toBe(true);
    expect(wrapper.find(".pd-brand").text()).toBe("LEKASI 乐卡思");
    expect(wrapper.find(".pd-poster-name").text()).toBe("卷绵薄垫万能款");
    expect(wrapper.find(".pd-poster-slogan").text()).toBe("6cm 薄垫 · 轻盈舒适");
  });

  it("信息条：feature 行 + 规格行逐字", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".pd-info-feature").text()).toBe(
      "细腻面料　｜　分层支撑　｜　简洁设计"
    );
    expect(wrapper.find(".pd-info-spec").text()).toBe(
      "规格：1800 × 2000 mm · 实际配置以产品说明为准"
    );
  });

  it("分页点数量随 detail_images（2 张 → 2 点，首点 active）", async () => {
    const wrapper = await mountPage();
    const dots = wrapper.findAll(".pd-dot");
    expect(dots).toHaveLength(2);
    expect(dots[0].classes()).toContain("pd-dot--active");
    expect(dots[1].classes()).not.toContain("pd-dot--active");
  });

  it("仅 1 张图时隐藏分页点", async () => {
    mockGetDetail.mockResolvedValue(
      makeDetail({ detail_images: ["/uploads/only-1.jpg"] })
    );
    const wrapper = await mountPage();
    expect(wrapper.findAll(".pd-dot")).toHaveLength(0);
    expect(wrapper.find(".pd-dots").exists()).toBe(false);
  });

  it("基本信息：产品名 19 + 型号行", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".pd-name").text()).toBe("卷绵薄垫万能款");
    expect(wrapper.find(".pd-model").text()).toBe("型号：JM-BD-06");
  });

  it("操作组：分享（open-type=share）/ 小程序码 / 圆形选款 52 标签", async () => {
    const wrapper = await mountPage();
    const share = wrapper.find(".pd-action.pd-action-hit");
    expect(share.exists()).toBe(true);
    expect(share.element.tagName.toLowerCase()).toBe("button");
    expect(share.attributes("open-type")).toBe("share");
    expect(share.find(".icon--share").exists()).toBe(true);
    expect(wrapper.find(".icon--qr-code").exists()).toBe(true);
    expect(wrapper.find(".pd-select-circle").exists()).toBe(true);
    expect(wrapper.find(".pd-select-circle-text").text()).toBe("选款");
  });

  it("区域分隔条 h10 存在", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".pd-divider").exists()).toBe(true);
  });

  it("详情 Tab 默认选中「产品详情」，实拍图未选", async () => {
    const wrapper = await mountPage();
    const tabs = wrapper.findAll(".pd-tab");
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.find(".pd-tab-text").text())).toEqual([
      "产品详情",
      "实拍图",
    ]);
    expect(tabs[0].classes()).toContain("pd-tab--active");
    expect(tabs[1].classes()).not.toContain("pd-tab--active");
  });

  it("详情 Tab：富文本渲染 detail_content + 免责文案", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".pd-rich").exists()).toBe(true);
    expect(wrapper.find(".pd-desc-disclaimer").text()).toBe(
      "尺寸、厚度与具体材质请以产品实物及说明为准。"
    );
    expect(wrapper.findAll(".pd-detail-image")).toHaveLength(1);
  });

  it("不实现版本标识条（Q12）", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".version-bar").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("参考复刻优化版");
  });

  it("底部 TabBar 为 two（首页 / 返回）", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".tabbar--two").exists()).toBe(true);
    const labels = wrapper
      .findAll(".tabbar-item .tabbar-label")
      .map((item) => item.text());
    expect(labels).toEqual(["首页", "返回"]);
  });
});

describe("产品详情页交互", () => {
  it("切到「实拍图」Tab → 渲染 real_images，detail 富文本消失", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll(".pd-tab")[1].trigger("tap");
    expect(wrapper.findAll(".pd-tab")[1].classes()).toContain("pd-tab--active");
    expect(wrapper.find(".pd-rich").exists()).toBe(false);
    expect(wrapper.findAll(".pd-detail-image")).toHaveLength(2);
  });

  it("实拍图为空 → 显示空态文案", async () => {
    mockGetDetail.mockResolvedValue(makeDetail({ real_images: [] }));
    const wrapper = await mountPage();
    await wrapper.findAll(".pd-tab")[1].trigger("tap");
    expect(wrapper.text()).toContain("暂无实拍图");
  });

  it("小程序码：点击打开弹层，点遮罩关闭", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".pd-mask").exists()).toBe(false);
    await wrapper.findAll(".pd-action-hit")[1].trigger("tap");
    expect(wrapper.find(".pd-mask").exists()).toBe(true);
    expect(wrapper.find(".pd-qr").exists()).toBe(true);
    await wrapper.find(".pd-mask").trigger("tap");
    expect(wrapper.find(".pd-mask").exists()).toBe(false);
  });

  it("圆形选款 → store 数量 +1 且 toast「已加入选品」", async () => {
    const wrapper = await mountPage();
    const store = useSelectionStore();
    expect(store.selectedCount).toBe(0);
    await wrapper.find(".pd-select-hit").trigger("tap");
    expect(store.selectedCount).toBe(1);
    expect(store.selectedProducts[0]).toEqual(
      expect.objectContaining({ id: 1, name: "卷绵薄垫万能款", model: "JM-BD-06" })
    );
    const uni = (globalThis as { uni: { showToast: ReturnType<typeof vi.fn> } }).uni;
    expect(uni.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "已加入选品" })
    );
  });

  it("重复选款按 id 去重，数量不变", async () => {
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.find(".pd-select-hit").trigger("tap");
    await wrapper.find(".pd-select-hit").trigger("tap");
    expect(store.selectedCount).toBe(1);
  });

  it("分享载荷：标题=产品名，路径带 id", async () => {
    await mountPage();
    expect(hoisted.shareHandler).toBeTypeOf("function");
    const payload = hoisted.shareHandler?.();
    expect(payload).toEqual(
      expect.objectContaining({
        title: "卷绵薄垫万能款",
        path: "/pages/product/detail?id=1",
      })
    );
  });
});

describe("产品详情页错误态（Q8 不做插图）", () => {
  it("缺 id 参数 → 错误态 + 返回入口，不请求接口", async () => {
    const wrapper = await mountPage({});
    expect(wrapper.text()).toContain("产品不存在或已下架");
    expect(wrapper.find(".pd-state-back").exists()).toBe(true);
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it("下架/404 → 错误态 + 重试", async () => {
    mockGetDetail.mockRejectedValue(new Error("404"));
    const wrapper = await mountPage({ id: "999" });
    expect(wrapper.text()).toContain("产品不存在或已下架");
    expect(wrapper.find(".pd-state-retry").exists()).toBe(true);
  });

  it("点返回 → navigateBack", async () => {
    const wrapper = await mountPage({});
    await wrapper.find(".pd-state-back").trigger("tap");
    const uni = (globalThis as { uni: { navigateBack: ReturnType<typeof vi.fn> } }).uni;
    expect(uni.navigateBack).toHaveBeenCalled();
  });

  it("加载中 → 加载态", async () => {
    let resolveDetail!: (value: WxProductDetail) => void;
    mockGetDetail.mockReturnValue(
      new Promise<WxProductDetail>((resolve) => {
        resolveDetail = resolve;
      })
    );
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("加载中…");
    resolveDetail(makeDetail());
    await flushPromises();
  });
});
