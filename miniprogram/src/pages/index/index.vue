<script setup lang="ts">
/**
 * 首页（MP-02）。视觉依据 docs/design/figma-exports/01-首页.png + ds-page.png token
 * （navy #1A2260 / yellow #F7C400 / cream #FDFBF5），版块顺序对照 jp/首页.jpg：
 * Banner 轮播 → 7 分类宫格 → 品牌服务横滚 → 资讯/客服入口；悬浮选款按钮常驻。
 */
import { onLoad } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getHome } from "@/api/content";
import { CUSTOMER_SERVICE, PRODUCT_LIST_TAB } from "@/config";
import { useProductFilterStore } from "@/stores/useProductFilterStore";
import type { WxArticleSummary, WxBanner, WxCategory, WxHome } from "@/types/home";
import { resolveBannerTarget } from "@/utils/jump";
import { absoluteUrl } from "@/utils/url";

type PageStatus = "loading" | "ready" | "error";

const filterStore = useProductFilterStore();
const pageStatus = ref<PageStatus>("loading");
const home = ref<WxHome | null>(null);
const statusBarHeight = ref(20);

const isEmptyHome = computed(
  (): boolean =>
    home.value !== null &&
    home.value.banners.length === 0 &&
    home.value.categories.length === 0 &&
    home.value.services.length === 0
);

onLoad(() => {
  const info = uni.getSystemInfoSync();
  statusBarHeight.value = info.statusBarHeight ?? 20;
  loadHome();
});

async function loadHome(): Promise<void> {
  pageStatus.value = "loading";
  try {
    home.value = await getHome();
    pageStatus.value = "ready";
  } catch {
    home.value = null;
    pageStatus.value = "error";
  }
}

function goProductList(): void {
  uni.switchTab({ url: PRODUCT_LIST_TAB });
}

function goCategory(categoryId: number): void {
  // 产品列表是 tabBar 页，switchTab 不带参，按核心约定 9 用 Pinia 传分类
  filterStore.requestCategory(categoryId);
  goProductList();
}

function onBannerTap(banner: WxBanner): void {
  const target = resolveBannerTarget(banner);
  switch (target.kind) {
    case "none":
      return;
    case "category":
      goCategory(target.categoryId);
      return;
    case "product":
      // 详情页 MP-04 落地前回退到产品列表（navigateTo fail 分支）
      uni.navigateTo({
        url: `/pages/product/detail?id=${target.productId}`,
        fail: () => {
          goProductList();
          uni.showToast({ title: "产品详情页建设中，先逛产品列表", icon: "none" });
        },
      });
      return;
    case "external":
      uni.navigateTo({
        url: `/pages/webview/index?url=${encodeURIComponent(target.url)}`,
      });
      return;
    default:
      uni.showToast({ title: target.reason, icon: "none" });
  }
}

function onCategoryTap(category: WxCategory): void {
  goCategory(category.id);
}

function onServiceTap(service: WxArticleSummary): void {
  uni.navigateTo({ url: `/pages/article/detail?id=${service.id}` });
}

function goNews(): void {
  uni.navigateTo({ url: "/pages/article/list" });
}

interface OpenCustomerServiceChatOptions {
  corpId: string;
  extInfo: { url: string };
  fail?: () => void;
}

function onContactTap(): void {
  const api = uni.openCustomerServiceChat as
    | ((options: OpenCustomerServiceChatOptions) => void)
    | undefined;
  if (typeof api !== "function") {
    uni.showToast({ title: "当前环境不支持在线客服", icon: "none" });
    return;
  }
  api({
    corpId: CUSTOMER_SERVICE.corpId,
    extInfo: { url: CUSTOMER_SERVICE.kfUrl },
    fail: () => {
      uni.showToast({ title: "客服暂不可用，请稍后再试", icon: "none" });
    },
  });
}
</script>

<template>
  <view class="home">
    <view class="status-bar" :style="'height:' + statusBarHeight + 'px'" />
    <view class="brand-row">
      <view class="brand-moon" />
      <text class="brand-name">乐卡思 LEKASI</text>
    </view>
    <view class="search-bar" @tap="goProductList">
      <view class="search-icon">
        <view class="search-icon-handle" />
      </view>
      <text class="search-placeholder">搜索产品 / 型号</text>
    </view>

    <view v-if="pageStatus === 'loading'" class="state-box">
      <text class="state-text">加载中…</text>
    </view>
    <view v-else-if="pageStatus === 'error'" class="state-box">
      <text class="state-text">首页内容加载失败</text>
      <view class="state-retry" @tap="loadHome">
        <text class="state-retry-text">重试</text>
      </view>
    </view>
    <view v-else-if="isEmptyHome" class="state-box">
      <text class="state-text">暂无内容</text>
    </view>
    <block v-else>
      <swiper
        v-if="home && home.banners.length > 0"
        class="home-banner"
        autoplay
        circular
        :interval="5000"
        :duration="400"
        indicator-dots
        indicator-color="rgba(255, 255, 255, 0.4)"
        indicator-active-color="#F7C400"
      >
        <swiper-item
          v-for="banner in home.banners"
          :key="banner.id"
          class="home-banner-slide"
          @tap="onBannerTap(banner)"
        >
          <view class="banner-fallback">
            <view class="banner-moon" />
            <text class="banner-slogan">为好眠，选对床垫</text>
            <text class="banner-sub">LEKASI · 匠心睡眠 30 年</text>
          </view>
          <image
            class="banner-image"
            :src="absoluteUrl(banner.image)"
            mode="aspectFill"
            lazy-load
          />
        </swiper-item>
      </swiper>

      <view v-if="home && home.categories.length > 0" class="section">
        <view class="section-head">
          <text class="section-title">产品分类</text>
        </view>
        <view class="category-grid">
          <view
            v-for="category in home.categories"
            :key="category.id"
            class="category-cell"
            @tap="onCategoryTap(category)"
          >
            <view class="category-icon">
              <text class="category-icon-fallback">{{
                category.name.slice(0, 2)
              }}</text>
              <image
                v-if="category.icon"
                class="category-icon-image"
                :src="absoluteUrl(category.icon)"
                mode="aspectFill"
                lazy-load
              />
            </view>
            <text class="category-name">{{ category.name }}</text>
          </view>
          <view class="category-more">
            <text class="category-more-title">更多系列</text>
            <text class="category-more-sub">敬请期待</text>
          </view>
        </view>
      </view>

      <view v-if="home && home.services.length > 0" class="section">
        <view class="section-head">
          <text class="section-title">品牌服务</text>
        </view>
        <scroll-view class="service-scroll" scroll-x :show-scrollbar="false">
          <view class="service-track">
            <view
              v-for="service in home.services"
              :key="service.id"
              class="service-card"
              @tap="onServiceTap(service)"
            >
              <view class="service-cover">
                <view class="service-moon" />
                <image
                  v-if="service.cover"
                  class="service-cover-image"
                  :src="absoluteUrl(service.cover)"
                  mode="aspectFill"
                  lazy-load
                />
              </view>
              <text class="service-title">{{ service.title }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="entry-row">
        <view class="entry-card" @tap="goNews">
          <view class="entry-icon">
            <text class="entry-icon-text">讯</text>
          </view>
          <text class="entry-title">乐卡思资讯</text>
          <text class="entry-sub">品牌动态与活动</text>
        </view>
        <view class="entry-card" @tap="onContactTap">
          <view class="entry-icon">
            <text class="entry-icon-text">客</text>
          </view>
          <text class="entry-title">联系客服</text>
          <text class="entry-sub">在线顾问 1v1</text>
        </view>
      </view>
    </block>

    <SelectFab />
  </view>
</template>

<style scoped>
.home {
  min-height: 100vh;
  padding-bottom: 48rpx;
  box-sizing: border-box;
  background-color: #fdfbf5;
}

.status-bar {
  width: 100%;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 32rpx;
}

.brand-moon {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  box-shadow: inset -10rpx 10rpx 0 0 #f7c400;
}

.brand-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a2260;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 72rpx;
  margin: 0 32rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background-color: #f4f6fa;
}

.search-icon {
  position: relative;
  width: 26rpx;
  height: 26rpx;
  border: 3rpx solid #8a90a3;
  border-radius: 50%;
}

.search-icon-handle {
  position: absolute;
  right: -9rpx;
  bottom: -6rpx;
  width: 12rpx;
  height: 3rpx;
  background-color: #8a90a3;
  transform: rotate(45deg);
}

.search-placeholder {
  font-size: 26rpx;
  color: #8a90a3;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 120rpx 32rpx;
}

.state-text {
  font-size: 26rpx;
  color: #8a90a3;
}

.state-retry {
  padding: 16rpx 64rpx;
  border-radius: 999rpx;
  background-color: #f7c400;
}

.state-retry-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a2260;
}

.home-banner {
  height: 320rpx;
  margin: 24rpx 32rpx 0;
  border-radius: 24rpx;
}

.home-banner-slide {
  position: relative;
  border-radius: 24rpx;
  overflow: hidden;
}

.banner-fallback {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a2260 0%, #111639 100%);
}

.banner-moon {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  box-shadow: inset -20rpx 20rpx 0 0 #f7c400;
}

.banner-slogan {
  font-size: 44rpx;
  font-weight: 600;
  color: #ffffff;
}

.banner-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
}

.banner-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.section {
  margin-top: 48rpx;
}

.section-head {
  padding: 0 32rpx 24rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1e2330;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24rpx;
  padding: 0 32rpx;
}

.category-cell,
.category-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  width: calc((100% - 24rpx) / 2);
  padding: 24rpx;
  border-radius: 24rpx;
  background-color: #ffffff;
  box-sizing: border-box;
}

.category-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 160rpx;
  border-radius: 16rpx;
  background-color: #e7eaf6;
  overflow: hidden;
}

.category-icon-fallback {
  font-size: 32rpx;
  font-weight: 600;
  color: #8890b8;
}

.category-icon-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.category-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e2330;
  text-align: center;
}

.category-more {
  align-items: center;
  justify-content: center;
  background-color: #f4f6fa;
}

.category-more-title {
  font-size: 28rpx;
  color: #8890b8;
}

.category-more-sub {
  font-size: 22rpx;
  color: #8a90a3;
}

.service-scroll {
  width: 100%;
  white-space: nowrap;
}

.service-track {
  display: inline-flex;
  gap: 24rpx;
  padding: 0 32rpx 8rpx;
}

.service-card {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  width: 400rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background-color: #1a2260;
  box-sizing: border-box;
}

.service-cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200rpx;
  border-radius: 16rpx;
  background-color: #111639;
  overflow: hidden;
}

.service-moon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  box-shadow: inset -14rpx 14rpx 0 0 #f7c400;
}

.service-cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.service-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #ffffff;
  white-space: normal;
}

.entry-row {
  display: flex;
  gap: 24rpx;
  margin: 48rpx 32rpx 0;
}

.entry-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 32rpx 24rpx;
  border-radius: 24rpx;
  background-color: #ffffff;
}

.entry-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 8rpx;
  border-radius: 50%;
  background-color: #fff8e1;
}

.entry-icon-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a2260;
}

.entry-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e2330;
}

.entry-sub {
  font-size: 22rpx;
  color: #8a90a3;
}
</style>
