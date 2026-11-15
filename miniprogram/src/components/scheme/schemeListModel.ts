/**
 * 方案列表页（MP-05C）静态内容与纯展示逻辑
 *
 * 真值来源：docs/design/references/plan-04-list.png + design-spec/spec.md §5.8 +
 * open-questions.md Q8（空态不插图）/ Q9（日期必须动态格式化）/ Q12（跳过版本条）。
 *
 * 抽出纯函数便于 vitest 覆盖：日期格式化、卡片视图映射、统计文案。
 */
import type { WxSchemeListItem } from "@/api/scheme";

/** 导航标题（spec §5.8）。 */
export const LIST_NAV_TITLE = "方案列表";

/** 底部提示（spec §5.8 ①）。 */
export const LIST_BOTTOM_HINT = "＊ 提示：长按方案删除 ＊";

/** 空态（Q8 DEFERRED：空白区域，不做插图）。 */
export const LIST_EMPTY_TEXT = "还没有方案";

/** 删除确认弹窗文案（Q8：弹窗未设计，用系统 modal）。 */
export const DELETE_CONFIRM_TITLE = "删除方案";
export const DELETE_CONFIRM_CONTENT = "删除后不可恢复，确定删除该方案？";
export const DELETE_SUCCESS_TOAST = "已删除";
export const DELETE_FAILED_TOAST = "删除失败";

/** 加载失败文案。 */
export const LIST_ERROR_TEXT = "方案列表加载失败";

/**
 * 把后端时间串格式化为 `YYYY.MM.DD`（Q9：禁止硬编码日期）。
 *
 * 后端 create_time 形如 `2026-11-15T14:14:06`（本地时间、无时区标记），
 * 也兼容带时区的 ISO 串。解析失败返回空串，由调用方决定如何降级展示。
 */
export function formatSchemeDate(input: string | null | undefined): string {
  if (input === null || input === undefined) return "";
  const text = String(input).trim();
  if (text === "") return "";

  // 优先按 ISO 的日期部分提取，避免 new Date() 在部分环境下把无时区串当 UTC 处理
  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (matched !== null) {
    return `${matched[1]}.${matched[2]}.${matched[3]}`;
  }

  // 兜底：交给 Date 解析（如 "2026/11/15"）
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

/** 副行 1：`标题：{title}`（spec §5.8 ①）。 */
export function titleLineOf(title: string): string {
  return `标题：${title}`;
}

/** 副行 2：`产品数量：{n} / 日期：{YYYY.MM.DD}`（spec §5.8 ① + Q9）。 */
export function metaLineOf(productCount: number, createTime: string | null): string {
  const count = Number.isFinite(productCount) ? Math.max(0, Math.floor(productCount)) : 0;
  const date = formatSchemeDate(createTime);
  return date === ""
    ? `产品数量：${count}`
    : `产品数量：${count} / 日期：${date}`;
}

/** 方案卡片视图（封面为空时由页面走占位层）。 */
export interface SchemeCardView {
  id: number;
  title: string;
  titleLine: string;
  metaLine: string;
  coverImage: string | null;
}

/** 后端列表项 → 卡片视图。 */
export function schemeCardViewsOf(items: readonly WxSchemeListItem[]): SchemeCardView[] {
  return items.map((item) => {
    const cover = (item.cover_image ?? "").trim();
    return {
      id: item.id,
      title: item.title,
      titleLine: titleLineOf(item.title),
      metaLine: metaLineOf(item.product_count, item.create_time),
      coverImage: cover === "" ? null : cover,
    };
  });
}
