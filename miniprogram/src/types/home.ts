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
  icon: string | null;
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
