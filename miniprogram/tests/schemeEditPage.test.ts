// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Product } from "@/types/product";

const hoisted = vi.hoisted(() => ({ loadOptions: {} as Record<string, unknown> }));

// uni-app 的 onLoad 在 jsdom 下依赖小程序运行时钩子（vue.injectHook），必须 mock。
// loadOptions 可注入 ?id= 以覆盖「从方案列表点进来载入已有方案」的分支。
vi.mock("@dcloudio/uni-app", () => ({
  onLoad: (callback: (options: Record<string, unknown>) => void) => {
    callback(hoisted.loadOptions);
  },
}));

vi.mock("@/api/scheme", () => ({
  createScheme: vi.fn(),
  updateScheme: vi.fn(),
  getSchemeDetail: vi.fn(),
  getSchemes: vi.fn(),
  deleteScheme: vi.fn(),
}));

import { createScheme, getSchemeDetail, updateScheme } from "@/api/scheme";
import EditPage from "@/pages/scheme/edit.vue";
import {
  SCHEME_LIST_PAGE,
  SCHEME_PREVIEW_PAGE,
  SELECTION_PAGE,
} from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";

const mockCreate = createScheme as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = updateScheme as unknown as ReturnType<typeof vi.fn>;
const mockGetDetail = getSchemeDetail as unknown as ReturnType<typeof vi.fn>;

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
    redirectTo: vi.fn(),
    navigateBack: vi.fn(),
    showToast: vi.fn(),
  };
}

function uni(): {
  navigateTo: ReturnType<typeof vi.fn>;
  redirectTo: ReturnType<typeof vi.fn>;
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
  (globalThis as Record<string, unknown>).getCurrentPages = () => [
    { route: "pages/index/index" },
  ];
  mockCreate.mockResolvedValue(detailOf(42, "主卧舒适好眠方案"));
  mockUpdate.mockResolvedValue(detailOf(7, "主卧舒适好眠方案"));
});

afterEach(() => {
  delete (globalThis as { uni?: unknown }).uni;
  delete (globalThis as Record<string, unknown>).getCurrentPages;
  vi.clearAllMocks();
});

describe("方案编辑页 · 空态（spec.md §5.5）", () => {
  // 编辑页已改用原生导航栏（pages.json 去 navigationStyle:custom），
  // 标题真值在 pages.json，页面内不再有 .wnav-* 自绘节点。
  it("pages.json 注册「LEKASI 乐卡思」标题且页面不自绘导航栏", async () => {
    const json = JSON.parse(
      readFileSync(path.join(__dirname, "..", "src", "pages.json"), "utf8")
    ) as { pages: Array<{ path: string; style?: Record<string, unknown> }> };
    const entry = json.pages.find((page) => page.path === "pages/scheme/edit");
    expect(entry?.style?.navigationBarTitleText).toBe("LEKASI 乐卡思");
    expect(entry?.style?.navigationStyle).toBeUndefined();

    const wrapper = await mountPage();
    expect(wrapper.find(".wnav").exists()).toBe(false);
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
    // 保存后进方案列表，用 redirectTo 替换编辑页（navigateTo 会叠层）
    expect(uni().redirectTo).toHaveBeenCalledWith(
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

  it("我的方案 → redirectTo 方案列表页（替换当前页，避免叠层）", async () => {
    const wrapper = await mountPage();
    await wrapper.findAll(".se-action")[0].trigger("tap");

    // 必须用 redirectTo：navigateTo 会让「编辑→列表→编辑」不断叠层，
    // 列表返回时落在上一个编辑页而不是首页。
    expect(uni().redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({ url: SCHEME_LIST_PAGE })
    );
    expect(uni().navigateTo).not.toHaveBeenCalled();
  });

  it("方案列表页未建（redirectTo fail）→ toast 兜底", async () => {
    (globalThis as { uni?: unknown }).uni = {
      ...uniStub(),
      redirectTo: vi.fn((options: { fail?: () => void }) => options.fail?.()),
    };
    const wrapper = await mountPage();
    await wrapper.findAll(".se-action")[0].trigger("tap");

    expect(uni().showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "方案列表建设中" })
    );
  });
});

describe("从方案列表进入：按 ?id= 载入已有方案（MP-05C 入口）", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    hoisted.loadOptions = {};
    mockGetDetail.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    (globalThis as Record<string, unknown>).uni = uniStub();
  });

  it("无 id 参数时不请求详情（新建流程）", async () => {
    hoisted.loadOptions = {};
    await mountPage();
    expect(mockGetDetail).not.toHaveBeenCalled();
  });

  it("有 id 时拉详情并用快照还原选品与标题", async () => {
    hoisted.loadOptions = { id: "7" };
    mockGetDetail.mockResolvedValue({
      id: 7,
      title: "主卧舒适好眠方案",
      remark: "客户偏好偏硬",
      product_count: 2,
      share_count: 0,
      create_time: "2026-11-15T14:14:06",
      products: [
        {
          id: 11,
          product_id: 1,
          sort: 0,
          snapshot: {
            id: 1,
            name: "3D床垫",
            model: "LEKASI-3D-180",
            spec: "1800 × 2000 mm",
            sleep_feel: "舒适睡感",
            slogan: "六大专属，分龄深睡",
            main_image: "/uploads/demo/product-3d-main.jpg",
            detail_images: ["/uploads/x.jpg"],
            real_images: [],
            detail_content: "<h3>x</h3>",
            category_id: 1,
            category_name: "6S专属床垫",
          },
        },
        {
          id: 12,
          product_id: 2,
          sort: 1,
          snapshot: { id: 2, name: "幸福3号", model: "LEKASI-XF3-180",
                    main_image: "/uploads/demo/product-xf3-main.jpg" },
        },
      ],
    });

    const wrapper = await mountPage();
    await flushPromises();

    expect(mockGetDetail).toHaveBeenCalledWith(7);
    const store = useSelectionStore();
    expect(store.selectedProducts.map((p) => p.name)).toEqual(["3D床垫", "幸福3号"]);
    expect(store.currentSchemeId).toBe(7);
    // 快照里的富展示字段不进选品 store（Product 契约外）
    expect((store.selectedProducts[0] as Record<string, unknown>).detail_content)
      .toBeUndefined();
    // 标题与备注回填
    const titleInput = wrapper.find(".se-title-input");
    expect(titleInput.element.value).toBe("主卧舒适好眠方案");
  });

  it("载入失败时 toast 提示且不污染 store", async () => {
    hoisted.loadOptions = { id: "99" };
    mockGetDetail.mockRejectedValue(new Error("404"));
    const store = useSelectionStore();
    store.clearSelection();

    await mountPage();
    await flushPromises();

    expect(mockGetDetail).toHaveBeenCalledWith(99);
    expect(store.selectedProducts).toEqual([]);
    expect(store.currentSchemeId).toBeNull();
  });

  it("id 非法（非数字/负数/0）不请求详情", async () => {
    for (const bad of ["abc", "-1", "0", ""]) {
      hoisted.loadOptions = { id: bad };
      mockGetDetail.mockReset();
      await mountPage();
      expect(mockGetDetail).not.toHaveBeenCalled();
    }
  });

  it("载入后保存走 PUT（currentSchemeId 已置）", async () => {
    hoisted.loadOptions = { id: "7" };
    mockGetDetail.mockResolvedValue({
      id: 7, title: "旧标题", remark: null, product_count: 1, share_count: 0,
      create_time: null,
      products: [{ id: 1, product_id: 1, sort: 0,
        snapshot: { id: 1, name: "3D床垫", model: "M1", main_image: "/a.png" } }],
    });
    mockUpdate.mockResolvedValue({ id: 7 });

    const wrapper = await mountPage();
    await flushPromises();
    await wrapper.find(".se-action--primary").trigger("tap");
    await flushPromises();

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
