import { vi, describe, it, expect, beforeEach } from "vitest";
import type { WxProductListItem, WxProductPage } from "@/types/product";

// 仅 mock 请求层：api/product.ts 的排序映射/参数组装走真实代码
vi.mock("@/utils/request", () => ({
  get: vi.fn(),
}));

import { get } from "@/utils/request";
import { useProductList, PRODUCT_PAGE_SIZE } from "@/composables/useProductList";

const mockGet = get as unknown as ReturnType<typeof vi.fn>;

function makeItem(id: number, overrides: Partial<WxProductListItem> = {}): WxProductListItem {
  return {
    id,
    category_id: 3,
    category_name: "卷绵时代",
    name: `产品${id}`,
    model: `M-${id}`,
    slogan: null,
    spec: "180×200",
    sleep_feel: "适中",
    main_image: `/uploads/p${id}.jpg`,
    sort: 0,
    ...overrides,
  };
}

function makePage(page: number, ids: number[], total: number): WxProductPage {
  return {
    items: ids.map((id) => makeItem(id)),
    total,
    page,
    size: PRODUCT_PAGE_SIZE,
  };
}

/** 提取 mockGet 第 callIndex 次调用的 query 参数。 */
function queryOf(callIndex = 0): Record<string, unknown> {
  return mockGet.mock.calls[callIndex][1] as Record<string, unknown>;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useProductList（GET /wxapi/products 分页/筛选/竞态）", () => {
  it("reload：请求默认参数（page=1/size=10/sort=comprehensive），成功后 ready", async () => {
    mockGet.mockResolvedValue(makePage(1, [1, 2], 2));
    const list = useProductList();
    expect(list.status.value).toBe("loading");
    await list.reload();
    expect(mockGet).toHaveBeenCalledWith(
      "/wxapi/products",
      { page: 1, size: PRODUCT_PAGE_SIZE, sort: "comprehensive" },
      { silent: true }
    );
    expect(list.status.value).toBe("ready");
    expect(list.items.value.map((p) => p.id)).toEqual([1, 2]);
    expect(list.total.value).toBe(2);
    expect(list.isEmpty.value).toBe(false);
    expect(list.hasMore.value).toBe(false);
  });

  it("loadMore：追加第二页并置 hasMore=false；无更多时不再发请求", async () => {
    mockGet.mockResolvedValueOnce(makePage(1, [1, 2], 3));
    const list = useProductList();
    await list.reload();
    expect(list.hasMore.value).toBe(true);

    mockGet.mockResolvedValueOnce(makePage(2, [3], 3));
    await list.loadMore();
    expect(queryOf(1).page).toBe(2);
    expect(list.items.value.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(list.hasMore.value).toBe(false);

    await list.loadMore();
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("loadMore：非 ready 状态（加载中）调用为 no-op", async () => {
    const d = deferred<WxProductPage>();
    mockGet.mockReturnValue(d.promise);
    const list = useProductList();
    const pending = list.reload();
    await list.loadMore();
    expect(mockGet).toHaveBeenCalledTimes(1);
    d.resolve(makePage(1, [1], 1));
    await pending;
  });

  it("setCategory：带 category_id 重新请求第一页；同分类 no-op；null 分类不带参", async () => {
    mockGet.mockResolvedValue(makePage(1, [1], 1));
    const list = useProductList();
    await list.reload();

    await list.setCategory(5);
    expect(queryOf(1)).toMatchObject({ page: 1, category_id: 5 });
    expect(list.categoryId.value).toBe(5);

    await list.setCategory(5);
    expect(mockGet).toHaveBeenCalledTimes(2);

    await list.setCategory(null);
    expect(queryOf(2)).not.toHaveProperty("category_id");
  });

  it("setSortTab：newest 传 sort=newest；recommended 回退 comprehensive（BE-05 仅支持两种）", async () => {
    mockGet.mockResolvedValue(makePage(1, [], 0));
    const list = useProductList();
    await list.reload();

    await list.setSortTab("newest");
    expect(queryOf(1).sort).toBe("newest");

    await list.setSortTab("recommended");
    expect(queryOf(2).sort).toBe("comprehensive");

    await list.setSortTab("recommended");
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it("search：关键词 trim 后传参；同词不重复请求；空词不带 keyword", async () => {
    mockGet.mockResolvedValue(makePage(1, [], 0));
    const list = useProductList();
    await list.reload();

    await list.search("  卷绵  ");
    expect(queryOf(1)).toMatchObject({ page: 1, keyword: "卷绵" });
    expect(list.keyword.value).toBe("卷绵");

    await list.search("卷绵");
    expect(mockGet).toHaveBeenCalledTimes(2);

    await list.search("");
    expect(queryOf(2)).not.toHaveProperty("keyword");
  });

  it("search：错误态下同词也重新请求（重试语义）", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const list = useProductList();
    await list.search("卷绵");
    expect(list.status.value).toBe("error");

    mockGet.mockResolvedValueOnce(makePage(1, [7], 1));
    await list.search("卷绵");
    expect(list.status.value).toBe("ready");
    expect(list.items.value.map((p) => p.id)).toEqual([7]);
  });

  it("首页请求失败：status=error、清空列表；reload 可恢复", async () => {
    mockGet.mockRejectedValueOnce(new Error("500"));
    const list = useProductList();
    await list.reload();
    expect(list.status.value).toBe("error");
    expect(list.items.value).toEqual([]);
    expect(list.isEmpty.value).toBe(false);

    mockGet.mockResolvedValueOnce(makePage(1, [1], 1));
    await list.reload();
    expect(list.status.value).toBe("ready");
  });

  it("loadMore 失败：loadMoreFailed=true 且保留已加载项；重试从失败页继续", async () => {
    mockGet.mockResolvedValueOnce(makePage(1, [1, 2], 3));
    const list = useProductList();
    await list.reload();

    mockGet.mockRejectedValueOnce(new Error("timeout"));
    await list.loadMore();
    expect(list.loadMoreFailed.value).toBe(true);
    expect(list.items.value).toHaveLength(2);
    expect(list.status.value).toBe("ready");

    mockGet.mockResolvedValueOnce(makePage(2, [3], 3));
    await list.loadMore();
    expect(queryOf(2).page).toBe(2);
    expect(list.loadMoreFailed.value).toBe(false);
    expect(list.items.value.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("竞态防护：慢的旧请求响应被丢弃，仅采纳最后一次请求结果", async () => {
    const first = deferred<WxProductPage>();
    const second = deferred<WxProductPage>();
    mockGet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const list = useProductList();

    const p1 = list.setCategory(1); // 第一次请求（慢）
    const p2 = list.setCategory(2); // 第二次请求（先返回）
    second.resolve(makePage(1, [20], 1));
    await p2;
    first.resolve(makePage(1, [10], 1));
    await p1;

    expect(list.items.value.map((p) => p.id)).toEqual([20]);
    expect(list.categoryId.value).toBe(2);
  });

  it("isEmpty：ready 且 0 条时为 true（空态展示依据）", async () => {
    mockGet.mockResolvedValue(makePage(1, [], 0));
    const list = useProductList();
    await list.reload();
    expect(list.isEmpty.value).toBe(true);
  });
});
