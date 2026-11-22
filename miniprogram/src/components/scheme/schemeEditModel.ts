/**
 * 方案编辑页（MP-05B，V3 二级页 §5.5 空态 / §5.7 填充态）静态文案与纯函数
 *
 * 真值来源：docs/design/references/plan-01-empty.png + plan-03-edit.png +
 * design-spec/spec.md §5.5 / §5.7（两画板同构，同一页两种状态）+
 * open-questions.md Q3（三按钮可配 variant）/ Q8（展开态未设计，最小可用）/
 * Q12（不实现版本条）/ Q13（移除角标透明热区 ≥44×44）。
 *
 * 抽出纯函数便于 vitest 覆盖：标题校验、数量文案、保存载荷、按钮 variant 配置。
 */
import type { Product } from "@/types/product";

/** 导航标题（spec.md §5.5 ①，逐字固定）。 */
export const EDIT_NAV_TITLE = "LEKASI 乐卡思";

/** 标题输入占位（spec.md §5.5 ①，逐字固定）。 */
export const TITLE_PLACEHOLDER = "方案标题";

/** 添加产品卡文案（spec.md §5.5 ① / §5.7 ①，逐字固定）。 */
export const ADD_PRODUCT_LABEL = "添加产品";

/** 产品数量前缀（spec.md §5.5 ①：`产品数量：N`，全角冒号）。 */
export const PRODUCT_COUNT_PREFIX = "产品数量：";

/** 详情展开提示文案（spec.md §5.5 ①）。 */
export const DETAIL_TOGGLE_LABEL = "详细说明";

/** 标题长度上限（后端 SchemeCreateIn：1-100 字）。 */
export const TITLE_MAX_LENGTH = 100;

/** 备注长度上限（后端 MAX_REMARK_LENGTH = 2000）。 */
export const REMARK_MAX_LENGTH = 2000;

/** 空标题保存拦截提示（Q8 反馈态：最小可用）。 */
export const TITLE_REQUIRED_MESSAGE = "请输入方案标题";

/** 标题超长提示（Q8 表单态：最小可用）。 */
export const TITLE_TOO_LONG_MESSAGE = `方案标题不能超过 ${TITLE_MAX_LENGTH} 字`;

/** 保存失败提示（后端 msg 缺失时的兜底）。 */
export const SAVE_FAILED_MESSAGE = "保存失败，请稍后重试";

/** 方案列表页未落地（MP-05C 之前）时的 toast 文案。 */
export const SCHEME_LIST_PENDING_TOAST = "方案列表建设中";

/** 预览分享页未落地（MP-05D 之前）时的 toast 文案。 */
export const SCHEME_PREVIEW_PENDING_TOAST = "预览分享建设中";

/** Q3：按钮视觉权重。本轮照稿等权重配置，优化阶段只改此处。 */
export type SchemeActionTone = "primary" | "secondary";

/** Q3：底部操作条按钮配置（一份数据驱动三个按钮，不写三份硬编码结构）。 */
export interface SchemeActionButtonConfig {
  key: "mine" | "save" | "preview";
  label: string;
  tone: SchemeActionTone;
}

/**
 * 本轮按画板等权重：`我的方案` 白底描边（secondary），`保存` 与 `预览分享`
 * 黄色主按钮（primary）。优化阶段（Q3）只改 tone 即可，结构/尺寸/路由不动。
 */
export const SCHEME_ACTION_BUTTONS: ReadonlyArray<SchemeActionButtonConfig> = [
  { key: "mine", label: "我的方案", tone: "secondary" },
  { key: "save", label: "保存", tone: "primary" },
  { key: "preview", label: "预览分享", tone: "primary" },
];

/** 产品数量文案：`产品数量：N`（非法/负数归零）。 */
export function productCountText(count: number): string {
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return `${PRODUCT_COUNT_PREFIX}${safe}`;
}

/**
 * 标题校验：返回错误文案，通过返回 null。
 * 两侧空白不计入长度；后端同规则（Pydantic min_length=1，但空白串会被视为
 * 有效字符，因此前端先 trim 再提交）。
 */
export function validateSchemeTitle(raw: string): string | null {
  const title = raw.trim();
  if (title === "") return TITLE_REQUIRED_MESSAGE;
  if (title.length > TITLE_MAX_LENGTH) return TITLE_TOO_LONG_MESSAGE;
  return null;
}

/** POST/PUT /wxapi/schemes 入参（对齐 backend SchemeCreateIn）。 */
export interface SchemeSavePayload {
  title: string;
  product_ids: number[];
  remark: string | null;
}

/** 组装保存载荷：标题/备注去两侧空白，产品 ID 按已选顺序拷贝（不可变）。 */
export function buildSchemePayload(
  rawTitle: string,
  productIds: readonly number[],
  rawRemark: string
): SchemeSavePayload {
  const remark = rawRemark.trim();
  return {
    title: rawTitle.trim(),
    product_ids: [...productIds],
    remark: remark === "" ? null : remark,
  };
}

/** 已选产品 ID 序列（store 为唯一真值，核心约定 9）。 */
export function productIdsOf(products: readonly Product[]): number[] {
  return products.map((product) => product.id);
}
