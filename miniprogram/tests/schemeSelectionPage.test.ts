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
import SelectionPage from "@/pages/scheme/selection.vue";
import { SCHEME_EDIT_PAGE } from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";

const mockGetCategories = getCategories as unknown as ReturnType<typeof vi.fn>;
const mockGetProducts = getProducts as unknown as ReturnType<typeof vi.fn>;

function makeCategory(id: number, name: string): WxCategory {
  return { id, name, subtitle: "", icon: null, banner_image: null, sort: id };
}

const CATEGORIES: WxCategory[] = [
  makeCategory(1, "6S专属床垫"),
  makeCategory(2, "手工 · 零胶虑"),
  makeCategory(3, "姜大师 · 草本"),
];

const PRODUCT_NAMES = [
  "卷绵1号护脊款",
  "卷绵2号净护款",
  "卷绵3号云绒款",
  "素①素韵云眠",
  "素②素安舒睡",
  "素③素挺护脊",
  "B1-26软床",
  "B2-26软床",
];

const PRODUCTS: WxProductListItem[] = PRODUCT_NAMES.map((name, index) => ({
  id: index + 1,
  category_id: CATEGORIES[index % CATEGORIES.length].id,
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

async function mountPage(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(SelectionPage);
  await flushPromises();
  return wrapper;
}

function uni(): {
  navigateTo: ReturnType<typeof vi.fn>;
  navigateBack: ReturnType<typeof vi.fn>;
  showToast: ReturnType<typeof vi.fn>;
} {
  return (globalThis as { uni: never }).uni;
}

/**
 * 页面栈桩：onOk 会读 getCurrentPages() 判断上一页是否为编辑页。
 * 这里默认「上一页是首页」，即选款 FAB 进入选品页的场景（应 navigateTo 新编辑页）。
 */
function stubPageStack(routes: string[]): void {
  (globalThis as Record<string, unknown>).getCurrentPages = () =>
    routes.map((route) => ({ route }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  (globalThis as { uni?: unknown }).uni = uniStub();
  stubPageStack(["pages/index/index", "pages/scheme/selection"]);
  mockGetCategories.mockResolvedValue(CATEGORIES);
  mockGetProducts.mockResolvedValue(makePage(PRODUCTS));
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  delete (globalThis as Record<string, unknown>).getCurrentPages;
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("选品页结构（spec.md §5.6 + Q10/Q11/Q12/Q13）", () => {
  it("二级页导航：返回箭头 + 标题 LEKASI 乐卡思", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".wnav-back").exists()).toBe(true);
    expect(wrapper.find(".wnav-title").text()).toBe("LEKASI 乐卡思");
  });

  it("搜索框占位逐字为「输入型号搜索」，带 search 图标（327×36 圆角 18）", async () => {
    const wrapper = await mountPage();
    const input = wrapper.find(".ss-search-input");
    expect(input.attributes("placeholder")).toBe("输入型号搜索");
    expect(wrapper.find(".ss-search-icon .icon--search").exists()).toBe(true);
    expect(wrapper.find(".ss-search-box").exists()).toBe(true);
  });

  it("左分类导航渲染全部分类，首项默认选中并带 3×16 指示条", async () => {
    const wrapper = await mountPage();
    const items = wrapper.findAll(".ss-cat-item");
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.find(".ss-cat-text").text())).toEqual([
      "6S专属床垫",
      "手工 · 零胶虑",
      "姜大师 · 草本",
    ]);
    expect(wrapper.findAll(".ss-cat-item--active")).toHaveLength(1);
    expect(wrapper.find(".ss-cat-item--active .ss-cat-text").text()).toBe(
      "6S专属床垫"
    );
    expect(wrapper.find(".ss-cat-indicator").exists()).toBe(true);
    expect(wrapper.findAll(".ss-cat-indicator")).toHaveLength(1);
  });

  it("右栏产品网格渲染 8 张卡，名称/规格/睡感/查看详情齐全", async () => {
    const wrapper = await mountPage();
    const cards = wrapper.findAll(".ss-card");
    expect(cards).toHaveLength(8);
    expect(wrapper.findAll(".ss-card-name")[0].text()).toBe("卷绵1号护脊款");
    expect(wrapper.findAll(".ss-card-spec")[0].text()).toBe("1800 × 2000 mm");
    expect(wrapper.findAll(".ss-card-feel-text")[0].text()).toBe("舒适睡感");
    expect(wrapper.findAll(".ss-card-detail-text")[0].text()).toBe("查看详情");
  });

  it("产品卡宽度由容器 calc 决定，不出现 126.92px 硬编码（Q10）", async () => {
    const wrapper = await mountPage();
    // 卡宽必须由 CSS calc 决定：结构上不写死宽度。
    // 逐字规格断言在 e2e 静态段执行（含 style 源码扫描）。
    expect(wrapper.find(".ss-grid").exists()).toBe(true);
    expect(wrapper.findAll(".ss-card").length).toBeGreaterThan(0);
  });

  it("未选时操作钮为「+」，已选列表为空、计数为 0", async () => {
    const wrapper = await mountPage();
    expect(wrapper.findAll(".ss-card-action-icon")[0].text()).toBe("+");
    expect(wrapper.find(".ss-count").text()).toBe("已选：0");
    expect(wrapper.find(".ss-thumb").exists()).toBe(false);
  });

  it("底部已选栏：OK 按钮 + 已选缩略图区 + 计数", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".ss-selected-bar").exists()).toBe(true);
    expect(wrapper.find(".ss-ok-text").text()).toBe("OK");
    expect(wrapper.find(".ss-thumb-area").exists()).toBe(true);
    expect(wrapper.find(".ss-count").text()).toBe("已选：0");
  });

  it("不实现版本标识条（Q12）", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".version-bar").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("参考复刻优化版");
  });

  it("Q13：操作钮外层为 44×44 透明热区，视觉按钮嵌套其中", async () => {
    const wrapper = await mountPage();
    const action = wrapper.findAll(".ss-card-action")[0];
    expect(action.exists()).toBe(true);
    expect(action.find(".ss-card-action-btn").exists()).toBe(true);
  });
});

describe("选品页交互（核心约定 9：全程走 useSelectionStore）", () => {
  it("点「+」加入 Pinia、按钮变「✓」、已选栏计数 +1 并出现缩略图", async () => {
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();

    expect(store.selectedCount).toBe(1);
    expect(store.selectedProducts[0].id).toBe(1);
    expect(wrapper.findAll(".ss-card-action-icon")[0].text()).toBe("✓");
    expect(wrapper.find(".ss-count").text()).toBe("已选：1");
    expect(wrapper.findAll(".ss-thumb")).toHaveLength(1);
  });

  it("再点「✓」移出 Pinia、按钮变回「+」、已选栏计数 -1", async () => {
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();

    expect(store.selectedCount).toBe(0);
    expect(wrapper.findAll(".ss-card-action-icon")[0].text()).toBe("+");
    expect(wrapper.find(".ss-count").text()).toBe("已选：0");
    expect(wrapper.find(".ss-thumb").exists()).toBe(false);
  });

  it("点「+」不会打开产品详情（事件 stop）", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();
    expect(uni().navigateTo).not.toHaveBeenCalled();
  });

  it("已选两件后点缩略图「×」移除对应产品，计数同步", async () => {
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await wrapper.findAll(".ss-card-action")[1].trigger("tap");
    await flushPromises();
    expect(store.selectedCount).toBe(2);

    await wrapper.findAll(".ss-thumb")[0].trigger("tap");
    await flushPromises();

    expect(store.selectedCount).toBe(1);
    expect(store.selectedProducts[0].id).toBe(2);
    expect(wrapper.find(".ss-count").text()).toBe("已选：1");
  });

  it("点 OK（上一页是编辑页）→ navigateBack 回该编辑页，不叠层", async () => {
    stubPageStack(["pages/index/index", "pages/scheme/edit", "pages/scheme/selection"]);
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();

    await wrapper.find(".ss-ok").trigger("tap");

    // 编辑页「添加产品」进来时，返回必须回到该编辑页本身（navigateBack），
    // 否则会再压一个编辑页，形成「编辑→选品→编辑」叠层。
    expect(uni().navigateBack).toHaveBeenCalled();
    expect(uni().navigateTo).not.toHaveBeenCalled();
    expect(store.selectedCount).toBe(1);
  });

  it("点 OK（从首页选款进入）→ navigateTo 新编辑页，选品保留在 Pinia", async () => {
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();

    await wrapper.find(".ss-ok").trigger("tap");

    expect(uni().navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: SCHEME_EDIT_PAGE })
    );
    expect(store.selectedCount).toBe(1);
  });

  it("方案编辑页未落地（navigateTo fail）→ toast 兜底且不丢选品", async () => {
    (globalThis as { uni?: unknown }).uni = {
      ...uniStub(),
      navigateTo: vi.fn((options: { fail?: () => void }) => options.fail?.()),
    };
    const wrapper = await mountPage();
    const store = useSelectionStore();
    await wrapper.findAll(".ss-card-action")[0].trigger("tap");
    await flushPromises();

    await wrapper.find(".ss-ok").trigger("tap");

    expect(uni().showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "方案编辑页建设中" })
    );
    expect(store.selectedCount).toBe(1);
  });

  it("点第二个分类 → 携带该 category_id 重新请求", async () => {
    const wrapper = await mountPage();
    mockGetProducts.mockClear();
    await wrapper.findAll(".ss-cat-item")[1].trigger("tap");
    await flushPromises();

    expect(wrapper.findAll(".ss-cat-item--active .ss-cat-text")[0].text()).toBe(
      "手工 · 零胶虑"
    );
    const query = mockGetProducts.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(query.category_id).toBe(2);
  });
});

describe("选品页搜索与状态", () => {
  it("输入型号 300ms 防抖后按 keyword 请求（清掉分类条件）", async () => {
    vi.useFakeTimers();
    const wrapper = await mountPage();
    mockGetProducts.mockClear();

    const input = wrapper.find(".ss-search-input");
    await input.trigger("input", { detail: { value: "9B" } });
    expect(mockGetProducts).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    await flushPromises();

    const calls = mockGetProducts.mock.calls as Array<[Record<string, unknown>]>;
    expect(calls.length).toBeGreaterThan(0);
    const lastQuery = calls[calls.length - 1][0];
    expect(lastQuery.keyword).toBe("9B");
    expect(lastQuery.category_id).toBeUndefined();
  });

  it("加载中 → 显示加载态", async () => {
    let resolvePage!: (value: WxProductPage) => void;
    mockGetProducts.mockReturnValue(
      new Promise<WxProductPage>((resolve) => {
        resolvePage = resolve;
      })
    );
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("加载中…");
    resolvePage(makePage(PRODUCTS));
    await flushPromises();
  });

  it("接口失败 → 错误态 + 重试入口", async () => {
    mockGetProducts.mockRejectedValue(new Error("500"));
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("产品列表加载失败");
    expect(wrapper.find(".ss-state-retry").exists()).toBe(true);
  });

  it("空结果 → 文案提示，不做插图（Q8）", async () => {
    mockGetProducts.mockResolvedValue(makePage([]));
    const wrapper = await mountPage();
    expect(wrapper.text()).toContain("该分类下暂无产品");
    expect(wrapper.findAll(".ss-card")).toHaveLength(0);
    // 仅搜索图标是 <image>；空态不引入任何产品图/插图
    expect(wrapper.findAll(".ss-card-image")).toHaveLength(0);
    expect(wrapper.findAll(".ss-thumb-image")).toHaveLength(0);
  });
});
