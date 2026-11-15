import { get, post, put } from "@/utils/request";

/** 方案保存入参（对齐 backend/src/schemas/wx_scheme.py SchemeCreateIn/SchemeUpdateIn）。 */
export interface SchemeSaveInput {
  title: string;
  product_ids: number[];
  remark: string | null;
}

/** 方案详情中的产品快照行（展示一律读 snapshot，核心约定 10）。 */
export interface WxSchemeProduct {
  id: number;
  product_id: number;
  sort: number;
  snapshot: Record<string, unknown>;
}

/** 方案详情（owner 视角）。 */
export interface WxSchemeDetail {
  id: number;
  title: string;
  remark: string | null;
  product_count: number;
  share_count: number;
  create_time: string | null;
  products: WxSchemeProduct[];
}

/** 我的方案列表项。 */
export interface WxSchemeListItem {
  id: number;
  title: string;
  remark: string | null;
  product_count: number;
  share_count: number;
  cover_image: string | null;
  create_time: string | null;
}

export interface WxSchemePage {
  items: WxSchemeListItem[];
  total: number;
  page: number;
  size: number;
}

/**
 * 创建方案。silent：错误由页面统一提示（避免 request 层 toast 与页面提示重复）。
 * 成功返回方案详情（含固化后的产品快照）。
 */
export function createScheme(input: SchemeSaveInput): Promise<WxSchemeDetail> {
  return post<WxSchemeDetail>("/wxapi/schemes", input, { silent: true });
}

/** 更新方案（整体替换语义：product_ids 变化会重新生成快照）。 */
export function updateScheme(
  id: number,
  input: SchemeSaveInput
): Promise<WxSchemeDetail> {
  return put<WxSchemeDetail>(`/wxapi/schemes/${id}`, input, { silent: true });
}

/** 方案详情（仅创建者）。 */
export function getSchemeDetail(id: number): Promise<WxSchemeDetail> {
  return get<WxSchemeDetail>(`/wxapi/schemes/${id}`, undefined, { silent: true });
}

/** 我的方案列表（分页）。 */
export function getSchemes(
  page = 1,
  size = 20
): Promise<WxSchemePage> {
  return get<WxSchemePage>(
    "/wxapi/schemes",
    { page, size },
    { silent: true }
  );
}
