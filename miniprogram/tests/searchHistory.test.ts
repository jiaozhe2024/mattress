import { vi, describe, it, expect, beforeEach } from "vitest";

// 内存 storage stub（核心约定 9：搜索历史属页面偏好，允许本地存储）
function installStorageStub(): { store: Map<string, string> } {
  const store = new Map<string, string>();
  vi.stubGlobal("uni", {
    getStorageSync: vi.fn((key: string) => store.get(key) ?? ""),
    setStorageSync: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeStorageSync: vi.fn((key: string) => {
      store.delete(key);
    }),
  });
  return { store };
}

let storage: { store: Map<string, string> };

beforeEach(() => {
  vi.resetModules();
  storage = installStorageStub();
});

async function load() {
  return await import("@/utils/searchHistory");
}

describe("searchHistory（10 条上限 / 去重置顶 / 边界防御）", () => {
  it("空存储时 loadSearchHistory 返回空数组", async () => {
    const { loadSearchHistory } = await load();
    expect(loadSearchHistory()).toEqual([]);
  });

  it("pushSearchHistory 记录并持久化，可被 load 读回", async () => {
    const { pushSearchHistory, loadSearchHistory } = await load();
    pushSearchHistory("卷绵");
    expect(loadSearchHistory()).toEqual(["卷绵"]);
  });

  it("同词去重并置顶，保持最近使用顺序", async () => {
    const { pushSearchHistory, loadSearchHistory } = await load();
    pushSearchHistory("A");
    pushSearchHistory("B");
    pushSearchHistory("A");
    expect(loadSearchHistory()).toEqual(["A", "B"]);
  });

  it("超过 10 条只保留最近 10 条（最旧被淘汰）", async () => {
    const { pushSearchHistory, loadSearchHistory, MAX_SEARCH_HISTORY } =
      await load();
    for (let i = 1; i <= 12; i += 1) {
      pushSearchHistory(`kw${i}`);
    }
    const result = loadSearchHistory();
    expect(result).toHaveLength(MAX_SEARCH_HISTORY);
    expect(result[0]).toBe("kw12");
    expect(result).not.toContain("kw1");
    expect(result).not.toContain("kw2");
  });

  it("空/纯空白关键词不入历史，返回现有历史", async () => {
    const { pushSearchHistory, loadSearchHistory } = await load();
    pushSearchHistory("真实词");
    expect(pushSearchHistory("   ")).toEqual(["真实词"]);
    expect(loadSearchHistory()).toEqual(["真实词"]);
  });

  it("关键词首尾空白被 trim 后存储", async () => {
    const { pushSearchHistory, loadSearchHistory } = await load();
    pushSearchHistory("  卷绵时代  ");
    expect(loadSearchHistory()).toEqual(["卷绵时代"]);
  });

  it("存储内容为损坏 JSON 时回退空数组（不抛错）", async () => {
    storage.store.set("product_search_history", "{not-json");
    const { loadSearchHistory } = await load();
    expect(loadSearchHistory()).toEqual([]);
  });

  it("存储内容非字符串数组时过滤非法项", async () => {
    storage.store.set(
      "product_search_history",
      JSON.stringify(["ok", 123, null, "  ", "good"])
    );
    const { loadSearchHistory } = await load();
    expect(loadSearchHistory()).toEqual(["ok", "good"]);
  });

  it("clearSearchHistory 清空历史与存储键", async () => {
    const { pushSearchHistory, clearSearchHistory, loadSearchHistory } =
      await load();
    pushSearchHistory("A");
    clearSearchHistory();
    expect(loadSearchHistory()).toEqual([]);
  });

  it("getStorageSync 抛错时 loadSearchHistory 回退空数组", async () => {
    (globalThis as any).uni.getStorageSync = vi.fn(() => {
      throw new Error("storage disabled");
    });
    const { loadSearchHistory } = await load();
    expect(loadSearchHistory()).toEqual([]);
  });
});
