export interface Product {
  id: number;
  name: string;
  model: string;
  main_image: string;
  spec?: string;
  sleep_feel?: string;
  slogan?: string;
  tags?: string[];
  price?: number;
}

/** GET /wxapi/products 列表项（对齐 backend/src/schemas/wx_content.py WxProductListItem，BE-05 契约）。 */
export interface WxProductListItem {
  id: number;
  category_id: number;
  category_name: string | null;
  name: string;
  model: string;
  slogan: string | null;
  spec: string | null;
  sleep_feel: string | null;
  main_image: string;
  sort: number;
}

/** GET /wxapi/products 分页载荷（信封 data 内）。 */
export interface WxProductPage {
  items: WxProductListItem[];
  total: number;
  page: number;
  size: number;
}