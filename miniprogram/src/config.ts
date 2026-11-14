/** 全局路由与微信能力占位配置（上线前替换为真实值）。 */

/** 选品/方案页目标路由（MP-05 落地前 SuspenseFab 回退到产品分类 tab）。 */
export const SELECTION_PAGE = "/pages/scheme/selection";

/** 方案编辑页（MP-05 落地前产品列表底部已选栏 OK 回退为 toast 保留选品）。 */
export const SCHEME_EDIT_PAGE = "/pages/scheme/edit";

/** 「产品」tab 页自 MP-03A 起为分类列表页，tabBar 跳转一律 switchTab。 */
export const PRODUCT_LIST_TAB = "/pages/product/category";

/** 产品列表页是普通页（MP-03A 起脱离 tabBar），可用 navigateTo 带 category_id。 */
export const PRODUCT_LIST_PAGE = "/pages/product/list";

/** 微信客服占位配置：corpId/客服链接需运营在企业微信后台开通后回填。 */
export const CUSTOMER_SERVICE = {
  corpId: "ww_placeholder_corp_id",
  kfUrl: "https://work.weixin.qq.com/kf/placeholder",
} as const;
