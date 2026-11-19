<script setup lang="ts">
/**
 * 首页（MP-02，V3 整块重写）
 *
 * 真值来源：docs/design/references/home.png + design-spec/spec.md §5.1 + open-questions Q14/Q15。
 * 版块顺序：品牌主视觉卡（轮播）→ 2×2 系列卡 + 3 寝具入口 → 乐卡思 · 好眠服务 →
 * 资讯/客服快捷入口 → 选款 FAB；底部 TabBar 由原生 custom-tab-bar 渲染（首页选中）。
 *
 * 数据：GET /wxapi/home（banners + services）+ GET /wxapi/categories（系列卡前 4 条）。
 * services 即 category=service 的已发布文章，渲染为「好眠服务」三张卡（数据由后台文章管理维护）。
 * 跨页传参（分类 / 型号关键词）按核心约定 9 走 Pinia。
 */
import { onLoad, onPageScroll, onPullDownRefresh, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getCategories } from "@/api/product";
import { getHome } from "@/api/content";
import SelectFab from "@/components/frame/SelectFab.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  BEDDING_ENTRIES,
  HOME_SERVICE_TITLE,
  QUICK_ENTRIES,
  bannerIndicatorCount,
  seriesCardViewsOf,
  serviceCardViewsOf,
  type QuickEntryKey,
  type SeriesCardView,
  type ServiceCardView,
} from "@/components/home/homeModel";
import { CUSTOMER_SERVICE, PRODUCT_LIST_PAGE, PRODUCT_LIST_TAB } from "@/config";
import { useProductFilterStore } from "@/stores/useProductFilterStore";
import type { WxArticleSummary, WxBanner, WxCategory } from "@/types/home";
import { resolveBannerTarget } from "@/utils/jump";
import { absoluteUrl } from "@/utils/url";

type PageStatus = "loading" | "ready" | "error";

const filterStore = useProductFilterStore();

// 滚动中降低选款 FAB 透明度：onPageScroll 无「停止」事件，用 180ms 尾沿去抖判定
const isScrolling = ref(false);
let scrollIdleTimer: ReturnType<typeof setTimeout> | null = null;

onPageScroll(() => {
  isScrolling.value = true;
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    isScrolling.value = false;
    scrollIdleTimer = null;
  }, 180);
});

onUnload(() => {
  if (scrollIdleTimer) clearTimeout(scrollIdleTimer);
  scrollIdleTimer = null;
});

const pageStatus = ref<PageStatus>("loading");
const banners = ref<WxBanner[]>([]);
const categories = ref<WxCategory[]>([]);
const services = ref<WxArticleSummary[]>([]);
const failedBannerIds = ref<number[]>([]);
const failedSeriesIds = ref<number[]>([]);
const failedServiceIds = ref<number[]>([]);
const bannerIndex = ref(0);

const seriesCards = computed(
  (): SeriesCardView[] => seriesCardViewsOf(categories.value, failedSeriesIds.value)
);

const serviceCards = computed(
  (): ServiceCardView[] =>
    serviceCardViewsOf(services.value, failedServiceIds.value)
);

/** 指示点数量：仅 1 张（或 0 张）时为 0，整块隐藏。 */
const indicatorCount = computed((): number =>
  bannerIndicatorCount(banners.value.length)
);

const isEmptyHome = computed(
  (): boolean =>
    pageStatus.value === "ready" &&
    banners.value.length === 0 &&
    categories.value.length === 0
);
onLoad(() => {
  void loadHome();
});

onPullDownRefresh(() => {
  // 刷新不走整页 loading（避免内容闪烁），失败时保留已渲染内容
  void loadHome({ isRefresh: true });
});

async function loadHome(
  options: { isRefresh?: boolean } = {}
): Promise<void> {
  const isRefresh = options.isRefresh === true;
  if (!isRefresh) pageStatus.value = "loading";
  let homeFailed = false;
  let categoriesFailed = false;

  try {
    const data = await getHome();
    banners.value = [...data.banners].sort(
      (a, b) => a.sort - b.sort || a.id - b.id
    );
    services.value = data.services;
  } catch {
    if (!isRefresh) {
      banners.value = [];
      services.value = [];
    }
    homeFailed = true;
  }

  try {
    categories.value = await getCategories();
  } catch {
    if (!isRefresh) categories.value = [];
    categoriesFailed = true;
  }

  if (isRefresh) {
    // 刷新成功则转为正常态；失败保留现状（已有内容继续展示 / 错误态保留重试入口）
    if (!homeFailed || !categoriesFailed) pageStatus.value = "ready";
    uni.stopPullDownRefresh();
    return;
  }

  // 两个接口全失败才算错误态；任一成功即按已有数据渲染（静态版块始终可显示）
  pageStatus.value = homeFailed && categoriesFailed ? "error" : "ready";
}

function goProductList(): void {
  uni.switchTab({ url: PRODUCT_LIST_TAB });
}

/**
 * 进入指定分类的产品列表。
 *
 * 为什么直接 navigateTo 产品列表页（不经 switchTab → 分类页 Pinia 转发）：
 * 旧实现在页面栈里塞进「分类页」这一层，导致用户点返回先回分类页、分类页又因
 * pending 请求再次跳回产品列表，形成死循环。产品列表页已支持 onLoad 的
 * category_id / category_name 参数，直达即可让返回正确回到首页。
 *
 * @param categoryId 分类 id
 * @param title 可选分类名；缺省时产品列表页会从 categories 接口自行解析标题
 */
function goCategory(categoryId: number, title?: string): void {
  const nameQuery =
    title === undefined || title === ""
      ? ""
      : `&category_name=${encodeURIComponent(title)}`;
  uni.navigateTo({
    url: `${PRODUCT_LIST_PAGE}?category_id=${categoryId}${nameQuery}`,
    fail: () => {
      // 兜底：极端情况（页面未注册等）回退到分类 tab
      filterStore.requestCategory(categoryId);
      goProductList();
    },
  });
}

/** 寝具入口不是分类：按型号关键词搜索产品（Q15 决议），同样直达产品列表页。 */
function goBeddingModel(model: string): void {
  uni.navigateTo({
    url: `${PRODUCT_LIST_PAGE}?keyword=${encodeURIComponent(model)}`,
    fail: () => {
      filterStore.requestKeyword(model);
      goProductList();
    },
  });
}

function goNews(): void {
  uni.navigateTo({ url: "/pages/article/list" });
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

function onBannerChange(event: { detail: { current: number } }): void {
  bannerIndex.value = event.detail.current;
}

function onBannerImageError(bannerId: number): void {
  if (!failedBannerIds.value.includes(bannerId)) {
    failedBannerIds.value = [...failedBannerIds.value, bannerId];
  }
}

function onSeriesImageError(categoryId: number): void {
  if (!failedSeriesIds.value.includes(categoryId)) {
    failedSeriesIds.value = [...failedSeriesIds.value, categoryId];
  }
}

function onServiceImageError(serviceId: number): void {
  if (!failedServiceIds.value.includes(serviceId)) {
    failedServiceIds.value = [...failedServiceIds.value, serviceId];
  }
}

function goServiceDetail(serviceId: number): void {
  uni.navigateTo({ url: `/pages/article/detail?id=${serviceId}` });
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

function onQuickEntryTap(key: QuickEntryKey): void {
  if (key === "news") {
    goNews();
    return;
  }
  onContactTap();
}
</script>

<template>
  <view class="home">
    <view v-if="pageStatus === 'loading'" class="home-state">
      <text class="home-state-text">加载中…</text>
    </view>
    <view v-else-if="pageStatus === 'error'" class="home-state">
      <text class="home-state-text">首页内容加载失败</text>
      <view class="home-state-retry" @tap="loadHome()">
        <text class="home-state-retry-text">重试</text>
      </view>
    </view>
    <view v-else class="home-body">
      <view v-if="isEmptyHome" class="home-state">
        <text class="home-state-text">暂无内容</text>
      </view>

      <!-- ① 品牌主视觉：整卡轮播（Q16：无文案区，banner 撑满原整卡高度） -->
      <view v-if="banners.length > 0" class="home-hero">
        <swiper
          class="home-hero-swiper"
          autoplay
          circular
          :interval="5000"
          :duration="400"
          :current="bannerIndex"
          @change="onBannerChange"
        >
          <swiper-item
            v-for="banner in banners"
            :key="banner.id"
            class="home-hero-slide"
            @tap="onBannerTap(banner)"
          >
            <view class="home-hero-placeholder" />
            <image
              v-if="!failedBannerIds.includes(banner.id)"
              class="home-hero-image"
              :src="absoluteUrl(banner.image)"
              mode="aspectFill"
              lazy-load
              @error="onBannerImageError(banner.id)"
            />
          </swiper-item>
        </swiper>
        <view v-if="indicatorCount > 0" class="home-hero-indicator">
          <view
            v-for="(banner, index) in banners"
            :key="banner.id"
            class="home-hero-dot"
            :class="{
              'home-hero-dot--active': index === bannerIndex % banners.length,
            }"
          />
        </view>
      </view>

      <!-- ② 产品系列入口：2×2 系列卡 + 3 寝具入口 -->
      <view class="home-series">
        <view v-if="seriesCards.length > 0" class="home-series-grid">
          <view
            v-for="card in seriesCards"
            :key="card.id"
            class="home-series-card"
            @tap="goCategory(card.id, card.title)"
          >
            <image
              v-if="card.imageSrc"
              class="home-series-image"
              :src="absoluteUrl(card.imageSrc)"
              mode="aspectFill"
              lazy-load
              @error="onSeriesImageError(card.id)"
            />
            <view v-else class="home-series-text">
              <text class="home-series-title">{{ card.title }}</text>
              <text v-if="card.subtitle !== ''" class="home-series-subtitle">{{
                card.subtitle
              }}</text>
            </view>
          </view>
        </view>

        <view class="home-bedding-row">
          <view
            v-for="entry in BEDDING_ENTRIES"
            :key="entry.model"
            class="home-bedding-card"
            @tap="goBeddingModel(entry.model)"
          >
            <text class="home-bedding-model">{{ entry.model }}</text>
            <text class="home-bedding-name">{{ entry.name }}</text>
          </view>
        </view>
      </view>

      <!-- ③ 乐卡思 · 好眠服务（数据源：/wxapi/home services，后台文章管理维护） -->
      <view v-if="serviceCards.length > 0" class="home-services">
        <text class="home-services-title">{{ HOME_SERVICE_TITLE }}</text>
        <view class="home-services-row">
          <view
            v-for="service in serviceCards"
            :key="service.id"
            class="home-service-card"
            @tap="goServiceDetail(service.id)"
          >
            <view class="home-service-media">
              <view class="home-service-placeholder" />
              <image
                v-if="service.imageSrc"
                class="home-service-image"
                :src="absoluteUrl(service.imageSrc)"
                mode="aspectFill"
                lazy-load
                @error="onServiceImageError(service.id)"
              />
            </view>
            <view class="home-service-text">
              <text class="home-service-title">{{ service.title }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- ④ 资讯与客服快捷入口 -->
      <view class="home-entries">
        <view
          v-for="entry in QUICK_ENTRIES"
          :key="entry.key"
          class="home-entry-card"
          @tap="onQuickEntryTap(entry.key)"
        >
          <Icon :name="entry.icon" :size="21" color="#1a2260" />
          <text class="home-entry-label">{{ entry.label }}</text>
        </view>
      </view>
    </view>

    <view class="select-fab-host"
      ><SelectFab class="select-fab-anchor" :scrolling="isScrolling"
    /></view>
  </view>
</template>

<style lang="scss" scoped>
.home {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  background-color: $color-cream;
}

.home-body {
  display: flex;
  flex-direction: column;
  gap: $space-20;
  /* 底部留白：内容不被原生 TabBar 与选款 FAB 遮挡 */
  padding: $space-16 $space-16 $space-fab-bottom;
}

/* ---------------- 状态（加载/错误/空） ---------------- */
.home-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-12;
  padding: $space-60 $space-16;
}

.home-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  color: $color-text-3;
  text-align: center;
}

.home-state-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 21px;
  padding: 0 $space-16;
  border-radius: $radius-pill;
  background-color: $color-yellow;
}

.home-state-retry-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-semibold;
  color: $color-navy;
}

/* ---------------- ① 品牌主视觉：整卡轮播 ---------------- */
.home-hero {
  position: relative;
  overflow: hidden;
  border-radius: $radius-16;
  background-color: $color-navy;
}

/* 高度 = 原「文案区 + 190 swiper + 24 指示点」整卡高度，banner 撑满 */
.home-hero-swiper {
  width: 100%;
  height: 383px;
}

.home-hero-slide {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.home-hero-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: $color-navy-deep;
}

.home-hero-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 指示点浮在图片底部（不占额外高度，图片区域仍撑满整卡） */
.home-hero-indicator {
  position: absolute;
  right: 0;
  bottom: $space-12;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $space-5;
  height: $space-24;
}

.home-hero-dot {
  width: $space-4;
  height: $space-4;
  border-radius: $radius-2;
  background-color: $color-navy-50;
}

.home-hero-dot--active {
  width: $space-16;
  background-color: $color-yellow;
}

/* ---------------- ② 系列卡 + 寝具入口 ---------------- */
.home-series {
  display: flex;
  flex-direction: column;
  gap: $space-8;
}

.home-series-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $space-5;
}

.home-series-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc((100% - 5px) / 2);
  height: 76px;
  overflow: hidden;
  border-radius: $radius-8;
  background-color: $color-text-inv;
}

.home-series-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.home-series-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-2;
  padding: 0 $space-8;
  box-sizing: border-box;
}

.home-series-title {
  font-family: $font-family-cn;
  font-size: $font-19;
  font-weight: $font-weight-bold;
  line-height: $line-height-19;
  color: $color-navy;
  text-align: center;
}

.home-series-subtitle {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-3;
  text-align: center;
}

.home-bedding-row {
  display: flex;
  gap: $space-6;
}

.home-bedding-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-4;
  height: 90px;
  border-radius: $radius-8;
  background-color: $color-text-inv;
}

.home-bedding-model {
  font-family: $font-family-en;
  font-size: $font-28;
  font-weight: $font-weight-bold;
  line-height: $line-height-28;
  color: $color-navy;
}

.home-bedding-name {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-navy;
}

/* ---------------- ③ 乐卡思 · 好眠服务 ---------------- */
.home-services {
  display: flex;
  flex-direction: column;
  gap: $space-12;
}

.home-services-title {
  font-family: $font-family-cn;
  font-size: $font-17;
  font-weight: $font-weight-bold;
  line-height: $line-height-17;
  color: $color-text-1;
}

.home-services-row {
  display: flex;
  gap: $space-6;
}

.home-service-card {
  flex: 1;
  overflow: hidden;
  border-radius: $radius-8;
  background-color: $color-text-inv;
}

.home-service-media {
  position: relative;
  width: 100%;
  height: 80px;
  overflow: hidden;
}

.home-service-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: $color-fill;
}

.home-service-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.home-service-text {
  display: flex;
  flex-direction: column;
  gap: $space-3;
  padding: $space-10 $space-6;
  box-sizing: border-box;
}

.home-service-title {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-medium;
  line-height: $line-height-12;
  color: $color-navy;
}

/* ---------------- ④ 资讯与客服 ---------------- */
.home-entries {
  display: flex;
  gap: $space-8;
}

.home-entry-card {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: $space-10;
  height: 62px;
  border-radius: $radius-8;
  background-color: $color-yellow-bg;
}

.home-entry-label {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13;
  color: $color-navy;
}
</style>
