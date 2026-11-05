import { get } from "@/utils/request";
import type {
  WxArticleDetail,
  WxArticlePage,
  WxHome,
} from "@/types/home";

export type ArticleCategory = "news" | "service";

export interface ArticleQuery {
  page?: number;
  size?: number;
  category?: ArticleCategory;
}

/** 首页聚合（banners+categories+services）。silent：错误由页面内联态展示，不重复 toast。 */
export function getHome(): Promise<WxHome> {
  return get<WxHome>("/wxapi/home", undefined, { silent: true });
}

export function getArticles(query: ArticleQuery = {}): Promise<WxArticlePage> {
  return get<WxArticlePage>(
    "/wxapi/articles",
    { page: 1, size: 20, ...query },
    { silent: true }
  );
}

export function getArticle(id: number): Promise<WxArticleDetail> {
  return get<WxArticleDetail>(`/wxapi/articles/${id}`, undefined, {
    silent: true,
  });
}
