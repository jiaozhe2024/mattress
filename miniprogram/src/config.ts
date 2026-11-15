/** 全局路由与微信能力占位配置（上线前替换为真实值）。 */

/** 选品页（MP-05A 已落地）；navigateTo 失败仍回退产品分类 tab（SelectFab）。 */
export const SELECTION_PAGE = "/pages/scheme/selection";

/** 方案编辑页（MP-05B 已落地；空态 / 填充态同页）。 */
export const SCHEME_EDIT_PAGE = "/pages/scheme/edit";

/** 方案列表页（MP-05C 未落地前 navigateTo fail → toast 兜底）。 */
export const SCHEME_LIST_PAGE = "/pages/scheme/list";

/** 预览分享页（MP-05D 未落地前 navigateTo fail → toast 兜底；保存先行）。 */
export const SCHEME_PREVIEW_PAGE = "/pages/scheme/preview";

/** 「产品」tab 页自 MP-03A 起为分类列表页，tabBar 跳转一律 switchTab。 */
export const PRODUCT_LIST_TAB = "/pages/product/category";

/** 产品列表页是普通页（MP-03A 起脱离 tabBar），可用 navigateTo 带 category_id。 */
export const PRODUCT_LIST_PAGE = "/pages/product/list";

/** 微信客服占位配置：corpId/客服链接需运营在企业微信后台开通后回填。 */
export const CUSTOMER_SERVICE = {
  corpId: "ww_placeholder_corp_id",
  kfUrl: "https://work.weixin.qq.com/kf/placeholder",
} as const;
