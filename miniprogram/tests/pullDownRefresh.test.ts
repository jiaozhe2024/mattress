import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 下拉刷新配置约束
 *
 * 小程序原生下拉刷新由页面级滚动触发，必须在 pages.json 的页面 style 里显式开启，
 * 否则 onPullDownRefresh 回调永不触发（scroll-view 内部滚动也不触发，需另行处理）。
 */
const PAGES_JSON = JSON.parse(
  readFileSync(path.join(__dirname, "..", "src", "pages.json"), "utf8")
) as {
  pages: Array<{ path: string; style?: Record<string, unknown> }>;
};

function styleOf(pagePath: string): Record<string, unknown> {
  const page = PAGES_JSON.pages.find((item) => item.path === pagePath);
  if (!page) throw new Error(`pages.json 未注册页面 ${pagePath}`);
  return page.style ?? {};
}

describe("原生下拉刷新：页面级滚动页", () => {
  it.each(["pages/index/index", "pages/product/category"])(
    "%s 开启 enablePullDownRefresh，且下拉区文案为深色",
    (pagePath) => {
      expect(styleOf(pagePath)).toMatchObject({
        enablePullDownRefresh: true,
        backgroundTextStyle: "dark",
      });
    }
  );
});
