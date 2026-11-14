/**
 * 微信原生 custom-tab-bar（three 变体：首页 / 产品 / 我的）
 *
 * 微信要求产物根级 custom-tab-bar/index 是原生组件（WXML 宿主），
 * 因此视觉由 index.wxml / index.wxss 表达，数据配置与 TabBar.vue 保持一致。
 * 页面 onShow 可调用 this.getTabBar().setSelected? 实际用 setData({selected})；
 * 本组件亦在 pageLifetimes.show 中按当前页路由自同步。
 */
const LIST = [
  {
    key: "home",
    pagePath: "/pages/index/index",
    text: "首页",
    icon: "/static/tabbar/home-normal.png",
    activeIcon: "/static/tabbar/home-active.png",
  },
  {
    key: "product",
    pagePath: "/pages/product/category",
    text: "产品",
    icon: "/static/tabbar/grid-normal.png",
    activeIcon: "/static/tabbar/grid-active.png",
  },
  {
    key: "user",
    pagePath: "/pages/user/index",
    text: "我的",
    icon: "/static/tabbar/user-normal.png",
    activeIcon: "/static/tabbar/user-active.png",
  },
];

function currentRouteIndex() {
  try {
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    if (!page) return 0;
    const route = "/" + page.route;
    const index = LIST.findIndex((item) => item.pagePath === route);
    return index >= 0 ? index : 0;
  } catch (e) {
    return 0;
  }
}

Component({
  data: {
    selected: 0,
    list: LIST,
  },
  lifetimes: {
    attached() {
      this.setData({ selected: currentRouteIndex() });
    },
  },
  pageLifetimes: {
    show() {
      this.setData({ selected: currentRouteIndex() });
    },
  },
  methods: {
    onTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = LIST[index];
      if (!item) return;
      this.setData({ selected: index });
      wx.switchTab({ url: item.pagePath });
    },
  },
});
