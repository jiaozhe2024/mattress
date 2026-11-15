/** 首页聚合与内容域类型（对齐 backend/src/schemas/wx_content.py BE-05 契约）。 */

export interface WxBanner {
  id: number;
  image: string;
  /** 1 无跳转 2 分类 3 产品 4 外链（models/enums.py BannerJumpType） */
  jump_type: number;
  jump_value: string | null;
  sort: number;
}

export interface WxCategory {
  id: number;
  name: string;
  /** 分类入口副文案文字（Q15 文字通道）。 */
  subtitle: string | null;
  icon: string | null;
  /** 分类入口整块图片 URL（Q15 图片通道，非空时优先于 name + subtitle 渲染）。 */
  banner_image: string | null;
  sort: number;
}

export interface WxArticleSummary {
  id: number;
  title: string;
  /** news 资讯 / service 服务板块 */
  category: string;
  cover: string | null;
  create_time: string | null;
}

export interface WxArticleDetail extends WxArticleSummary {
  content: string | null;
}

export interface WxHome {
  banners: WxBanner[];
  categories: WxCategory[];
  services: WxArticleSummary[];
}

export interface WxArticlePage {
  items: WxArticleSummary[];
  total: number;
  page: number;
  size: number;
}

/** GET /wxapi/brand 品牌配置（单行，对齐 backend WxBrandOut）。 */
export interface WxBrandInfo {
  id: number;
  intro: string | null;
  join_phone: string | null;
  service_promise: string[] | null;
  store_images: string[] | null;
}
