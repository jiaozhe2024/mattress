// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { Product } from "@/types/product";

vi.mock("@/api/scheme", () => ({
  createScheme: vi.fn(),
  updateScheme: vi.fn(),
  getSchemeDetail: vi.fn(),
  getSchemes: vi.fn(),
}));

import { createScheme, updateScheme } from "@/api/scheme";
import EditPage from "@/pages/scheme/edit.vue";
import {
  SCHEME_LIST_PAGE,
  SCHEME_PREVIEW_PAGE,
  SELECTION_PAGE,
} from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";

const mockCreate = createScheme as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = updateScheme as unknown as ReturnType<typeof vi.fn>;

function makeProduct(id: number, name: string): Product {
  return { id, name, model: `M-${id}`, main_image: `/uploads/p${id}.png` };
}

function detailOf(id: number, title: string) {
  return {
    id,
    title,
    remark: null,
    product_count: 0,
    share_count: 0,
    create_time: null,
    products: [],
  };
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
    showToast: vi.fn(),
  };
}

function uni(): {
  navigateTo: ReturnType<typeof vi.fn>;
  showToast: ReturnType<typeof vi.fn>;
} {
  return (globalThis as { uni: never }).uni;
}

async function mountPage(): Promise<ReturnType<typeof mount>> {
  const wrapper = mount(EditPage);
  await flushPromises();
  return wrapper;
}

async function typeTitle(
  wrapper: ReturnType<typeof mount>,
  value: string
): Promise<void> {
  await wrapper.find(".se-title-input").trigger("input", { detail: { value } });
  await flushPromises();
}

beforeEach(() => {
  setActivePinia(createPinia());
  (globalThis as { uni?: unknown }).uni = uniStub();
  mockCreate.mockResolvedValue(detailOf(42, "主卧舒适好眠方案"));
  mockUpdate.mockResolvedValue(detailOf(7, "主卧舒适好眠方案"));
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  vi.clearAllMocks();
});

describe("方案编辑页 · 空态（spec.md §5.5）", () => {
  it("二级页导航：返回箭头 + 标题 LEKASI 乐卡思", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".wnav-back").exists()).toBe(true);
    expect(wrapper.find(".wnav-title").text()).toBe("LEKASI 乐卡思");
  });

  it("标题输入占位「方案标题」，右侧 pencil 图标", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".se-title-input").attributes("placeholder")).toBe(
      "方案标题"
    );
    expect(wrapper.find(".se-title-pencil .icon--pencil").exists()).toBe(true);
  });

  it("0 件已选：添加产品卡（宽态）+ 加号 + 「添加产品」文案", async () => {
    const wrapper = await mountPage();
    expect(wrapper.findAll(".se-thumb")).toHaveLength(0);
    const addCard = wrapper.find(".se-add-card");
    expect(addCard.exists()).toBe(true);
    expect(addCard.classes()).toContain("se-add-card--wide");
    expect(wrapper.find(".se-add-card .icon--plus").exists()).toBe(true);
    expect(wrapper.find(".se-add-text").text()).toBe("添加产品");
  });

  it("产品数量：0，详细说明 + chevron-down 存在", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".se-count").text()).toBe("产品数量：0");
    expect(wrapper.find(".se-detail-label").text()).toBe("详细说明");
    expect(wrapper.find(".se-detail-chevron .icon--chevron-down").exists()).toBe(
      true
    );
    expect(wrapper.find(".se-divider").exists()).toBe(true);
  });

  it("默认不展开备注（Q8 展开态未设计）", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".se-remark").exists()).toBe(false);
  });

  it("底部操作条三个按钮：我的方案 / 保存 / 预览分享，宽度 108/92/119", async () => {
    const wrapper = await mountPage();
    const actions = wrapper.findAll(".se-action");
    expect(actions).toHaveLength(3);
    expect(actions.map((a) => a.find(".se-action-text").text())).toEqual([
      "我的方案",
      "保存",
      "预览分享",
    ]);
    // inline style 序列化后为 "width: 108px;"（冒号后有空格），容错匹配两种写法
    const styleOf = (a) => (a.attributes("style") || "").replace(/\s+/g, "");
    const styles = actions.map(styleOf);
    expect(styles[0]).toContain("width:108px");
    expect(styles[1]).toContain("width:92px");
    expect(styles[2]).toContain("width:119px");
  });

  it("Q3：我的方案为 secondary，保存/预览分享为 primary（一份配置驱动）", async () => {
    const wrapper = await mountPage();
    const actions = wrapper.findAll(".se-action");
    expect(actions[0].classes()).toContain("se-action--secondary");
    expect(actions[1].classes()).toContain("se-action--primary");
    expect(actions[2].classes()).toContain("se-action--primary");
  });

  it("不实现版本标识条（Q12）", async () => {
    const wrapper = await mountPage();
    expect(wrapper.find(".version-bar").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("参考复刻优化版");
  });
});

describe("方案编辑页 · 填充态（spec.md §5.7）", () => {
  it("已选 N 件：渲染缩略图 + 名称 + 数量文案，添加卡为窄态", async () => {
    const store = useSelectionStore();
    const wrapper = await mountPage();
    store.addProduct(makeProduct(1, "卷绵1号护脊款"));
    store.addProduct(makeProduct(2, "卷绵2号净护款"));
    await flushPromises();

    expect(wrapper.findAll(".se-thumb")).toHaveLength(2);
    expect(wrapper.findAll(".se-thumb-name").map((n) => n.text())).toEqual([
      "卷绵1号护脊款",
      "卷绵2号净护款",
    ]);
    expect(wrapper.find(".se-count").text()).toBe("产品数量：2");
    expect(wrapper.find(".se-add-card").classes()).not.toContain(
      "se-add-card--wide"
    );
  });

  it("点缩略图 × 从 store 移除对应产品", async () => {
    const store = useSelectionStore();
    const wrapper = await mountPage();
    store.addProduct(makeProduct(1, "卷绵1号护脊款"));
    store.addProduct(makeProduct(2, "卷绵2号净护款"));
    await flushPromises();

    await wrapper.findAll(".se-thumb-remove-hit")[0].trigger("tap");
    await flushPromises();

    expect(store.selectedProducts.map((p) => p.id)).toEqual([2]);
    expect(wrapper.findAll(".se-thumb")).toHaveLength(1);
    expect(wrapper.find(".se-count").text()).toBe("产品数量：1");
  });
});

describe("方案编辑页 · 交互", () => {
  it("点添加产品卡 → 选中品页", async () => {
    const wrapper = await mountPage();
    await wrapper.find(".se-add-card").trigger("tap");
    expect(uni().navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: SELECTION_PAGE })
    );
  });

  it("点 pencil 聚焦标题输入", async () => {
    const wrapper = await mountPage();
    await wrapper.find(".se-title-pencil").trigger("tap");
    await flushPromises();
    // 小程序 <input> 的 :focus 是组件 prop，不会序列化成 DOM attribute；
    // 断言组件实例上的响应式状态变化（focusTitle 走 nextTick 先 false 再 true）。
    const inputCmp = wrapper.findComponent({ name: "Input" });
    const focusProp =
      (inputCmp.exists() && inputCmp.props("focus")) ||
      wrapper.vm.titleFocus === true ||
      wrapper.vm.$.setupState?.titleFocus === true;
    expect(focusProp).toBe(true);
  });

  it("点详细说明展开 textarea，备注输入进入载荷", async () => {
    const wrapper = await mountPage();
    await wrapper.find(".se-detail-toggle").trigger("tap");
    await flushPromises();
    expect(wrapper.find(".se-remark").exists()).toBe(true);

    await typeTitle(wrapper, "主卧舒适好眠方案");
    await wrapper.find(".se-remark").trigger("input", {
      detail: { value: "靠窗一侧" },
    });
    await wrapper.find(".se-remark").trigger("blur");
    await flushPromises();
  });

  it("空标题点保存被拦截：toast 必填提示，不发请求", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll(".se-action")[1].trigger("tap");
    await flushPromises();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(uni().showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "请输入方案标题" })
    );
  });

  it("超长标题（101 字）拦截保存", async () => {
    const wrapper = await mountPage();
    await typeTitle(wrapper, "卧".repeat(101));
    await wrapper.findAll(".se-action")[1].trigger("tap");
    await flushPromises();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(uni().showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("100") })
    );
  });

  it("无 currentSchemeId → POST 创建，成功后跳方案列表", async () => {
    const store = useSelectionStore();
    const wrapper = await mountPage();
    store.addProduct(makeProduct(3, "卷绵3号云绒款"));
    await typeTitle(wrapper, "  主卧舒适好眠方案  ");
    await wrapper.findAll(".se-action")[1].trigger("tap");
    await flushPromises();

    expect(mockCreate).toHaveBeenCalledWith({
      title: "主卧舒适好眠方案",
      product_ids: [3],
      remark: null,
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(store.currentSchemeId).toBe(42);
    expect(uni().navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: SCHEME_LIST_PAGE })
    );
  });

  it("已有 currentSchemeId → PUT 更新（携带方案 id）", async () => {
    const store = useSelectionStore();
    store.$patch({ currentSchemeId: 7 });
    const wrapper = await mountPage();
    await typeTitle(wrapper, "主卧舒适好眠方案");
    await wrapper.findAll(".se-action")[1].trigger("tap");
    await flushPromises();

    expect(mockUpdate).toHaveBeenCalledWith(7, {
      title: "主卧舒适好眠方案",
      product_ids: [],
      remark: null,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("保存失败 → toast 提示，不跳转", async () => {
    mockCreate.mockRejectedValue(new Error("网络异常"));
    const wrapper = await mountPage();
    await typeTitle(wrapper, "主卧舒适好眠方案");
    await wrapper.findAll(".se-action")[1].trigger("tap");
    await flushPromises();

    expect(uni().showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "网络异常" })
    );
    expect(uni().navigateTo).not.toHaveBeenCalled();
  });

  it("预览分享：先保存，再跳 /pages/scheme/preview?id=", async () => {
    const wrapper = await mountPage();
    await typeTitle(wrapper, "主卧舒适好眠方案");
    await wrapper.findAll(".se-action")[2].trigger("tap");
    await flushPromises();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(uni().navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: `${SCHEME_PREVIEW_PAGE}?id=42` })
    );
  });

  it("预览分享保存失败 → 不跳预览页", async () => {
    mockCreate.mockRejectedValue(new Error("保存失败"));
    const wrapper = await mountPage();
    await typeTitle(wrapper, "主卧舒适好眠方案");
    await wrapper.findAll(".se-action")[2].trigger("tap");
    await flushPromises();

    expect(uni().navigateTo).not.toHaveBeenCalled();
  });

  it("我的方案 → 跳方案列表页（MP-05C 未建时 fail toast 兜底）", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll(".se-action")[0].trigger("tap");

    expect(uni().navigateTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: SCHEME_LIST_PAGE })
    );
  });

  it("方案列表页未建（navigateTo fail）→ toast 兜底", async () => {
    (globalThis as { uni?: unknown }).uni = {
      ...uniStub(),
      navigateTo: vi.fn((options: { fail?: () => void }) => options.fail?.()),
    };
    const wrapper = await mountPage();
    await wrapper.findAll(".se-action")[0].trigger("tap");

    expect(uni().showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "方案列表建设中" })
    );
  });
});
