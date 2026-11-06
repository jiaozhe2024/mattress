/**
 * 产品搜索历史（本地存储，最多 10 条）。
 * 核心约定 9 仅禁止用 uni storage 传「选品数据」；搜索历史属页面偏好，允许本地存储。
 */
const STORAGE_KEY = "product_search_history";
export const MAX_SEARCH_HISTORY = 10;

function persist(history: readonly string[]): void {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // 存储配额/序列化失败不阻塞搜索主流程
  }
}

/** 读取历史；存储损坏或非字符串数组时回退空列表（边界防御）。 */
export function loadSearchHistory(): string[] {
  let raw: unknown;
  try {
    raw = uni.getStorageSync(STORAGE_KEY);
  } catch {
    return [];
  }
  if (typeof raw !== "string" || raw === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .slice(0, MAX_SEARCH_HISTORY);
  } catch {
    return [];
  }
}

/** 记录一条搜索：去重（同词置顶）、截断 10 条、持久化，返回新数组（不改入参）。 */
export function pushSearchHistory(keyword: string): string[] {
  const trimmed = keyword.trim();
  if (trimmed === "") return loadSearchHistory();
  const next = [
    trimmed,
    ...loadSearchHistory().filter((item) => item !== trimmed),
  ].slice(0, MAX_SEARCH_HISTORY);
  persist(next);
  return next;
}

export function clearSearchHistory(): void {
  persist([]);
  try {
    uni.removeStorageSync(STORAGE_KEY);
  } catch {
    // 已写空值，remove 失败可忽略
  }
}
