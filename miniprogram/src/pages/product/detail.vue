<script setup lang="ts">
/**
 * 产品详情页（MP-04，V3 二级页）
 *
 * 真值来源：docs/design/references/product-detail.png + design-spec/spec.md §5.4 +
 * open-questions.md Q8（缺失态不做插图）/ Q12（不实现版本条）/ Q13（热区先行）。
 *
 * 结构：微信导航（二级页）→ 产品介绍海报（标题 / 图集 / 信息条）→ 分页点 →
 * 产品基本信息 + 操作组 → 区域分隔 → 产品详情/实拍图 Tab → TabBar two。
 *
 * 数据：GET /wxapi/products/{id}（下架/不存在 404 → 错误态）。
 * 选款：useSelectionStore.addProduct（核心约定 9，禁止 storage 传参）。
 */
import { onLoad, onShareAppMessage } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getProductDetail } from "@/api/product";
import {
  DETAIL_DISCLAIMER,
  DETAIL_ERROR_TEXT,
  DETAIL_NAV_TITLE,
  DETAIL_TABS,
  EMPTY_DETAIL_TEXT,
  EMPTY_REAL_TEXT,
  QR_LABEL,
  SELECTED_TOAST,
  SELECT_LABEL,
  SHARE_LABEL,
  detailImageOf,
  featureLineOf,
  modelLineOf,
  parseProductId,
  posterImagesOf,
  productNameOf,
  realImagesOf,
  shareMessageOf,
  specLineOf,
  type DetailTabKey,
  type WxProductDetail,
} from "@/components/product/productDetailModel";
import SafeArea from "@/components/frame/SafeArea.vue";
import TabBar from "@/components/frame/TabBar.vue";
import WechatNav from "@/components/frame/WechatNav.vue";
import Icon from "@/components/icons/Icon.vue";
import type { Product } from "@/types/product";
import { useSelectionStore } from "@/stores/useSelectionStore";
import { absoluteUrl } from "@/utils/url";

type PageStatus = "loading" | "ready" | "error";

/** 图标色镜像 token（Icon 的 color 进 SVG data URI，无法取 CSS 变量）。 */
const ACTION_ICON_COLOR = "#4a5165";

const selectionStore = useSelectionStore();

const status = ref<PageStatus>("loading");
const product = ref<WxProductDetail | null>(null);
const activeTab = ref<DetailTabKey>("detail");
const activeImage = ref(0);
const qrOpen = ref(false);
const productId = ref<number | null>(null);

const posterImages = computed((): string[] =>
  product.value ? posterImagesOf(product.value).map((src) => absoluteUrl(src)) : []
);

const showDots = computed((): boolean => posterImages.value.length > 1);

const detailImage = computed((): string =>
  product.value ? absoluteUrl(detailImageOf(product.value)) : ""
);

const realImages = computed((): string[] =>
  product.value ? realImagesOf(product.value).map((src) => absoluteUrl(src)) : []
);

const featureLine = computed((): string =>
  product.value ? featureLineOf(product.value) : ""
);

const specLine = computed((): string =>
  product.value ? specLineOf(product.value) : ""
);

const name = computed((): string =>
  product.value ? productNameOf(product.value) : ""
);

const modelLine = computed((): string =>
  product.value ? modelLineOf(product.value) : ""
);

const detailContent = computed((): string => product.value?.detail_content ?? "");

onLoad((options) => {
  const id = parseProductId(options?.id);
  if (id === null) {
    status.value = "error";
    return;
  }
  productId.value = id;
  void loadProduct(id);
});

onShareAppMessage(() => {
  if (!product.value) {
    return { title: DETAIL_NAV_TITLE, path: "/pages/index/index" };
  }
  const message = shareMessageOf(product.value);
  return {
    title: message.title,
    path: message.path,
    ...(message.imageUrl !== undefined
      ? { imageUrl: absoluteUrl(message.imageUrl) }
      : null),
  };
});

async function loadProduct(id: number): Promise<void> {
  status.value = "loading";
  try {
    product.value = await getProductDetail(id);
    status.value = "ready";
  } catch {
    product.value = null;
    status.value = "error";
  }
}

function onRetry(): void {
  if (productId.value !== null) void loadProduct(productId.value);
}

function goBack(): void {
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: "/pages/index/index" });
    },
  });
}

function onDotChange(event: Event): void {
  const detail = (event as CustomEvent<{ current: number }>).detail;
  activeImage.value = typeof detail?.current === "number" ? detail.current : 0;
}

function onTabTap(key: DetailTabKey): void {
  activeTab.value = key;
}

function onOpenQr(): void {
  qrOpen.value = true;
}

function onCloseQr(): void {
  qrOpen.value = false;
}

function noop(): void {
  /* 遮罩/弹层本体点击不穿透关闭以外的行为 */
}

function toSelectionProduct(item: WxProductDetail): Product {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
    main_image: item.main_image,
    ...(item.slogan !== null ? { slogan: item.slogan } : null),
    ...(item.spec !== null ? { spec: item.spec } : null),
    ...(item.sleep_feel !== null ? { sleep_feel: item.sleep_feel } : null),
  };
}

function onSelect(): void {
  if (product.value === null) return;
  selectionStore.addProduct(toSelectionProduct(product.value));
  uni.showToast({ title: SELECTED_TOAST, icon: "none" });
}
</script>

<template>
  <view class="pd-page">
    <WechatNav :title="DETAIL_NAV_TITLE" back />

    <scroll-view class="pd-scroll" scroll-y :show-scrollbar="false">
      <view v-if="status === 'loading'" class="pd-state">
        <text class="pd-state-text">加载中…</text>
      </view>

      <view v-else-if="status === 'error'" class="pd-state">
        <text class="pd-state-text">{{ DETAIL_ERROR_TEXT }}</text>
        <view class="pd-state-back" @tap="goBack">
          <text class="pd-state-back-text">返回上一页</text>
        </view>
        <view v-if="productId !== null" class="pd-state-retry" @tap="onRetry">
          <text class="pd-state-retry-text">重试</text>
        </view>
      </view>

      <template v-else-if="product">
        <!-- ① 产品介绍海报 -->
        <view class="pd-poster">
          <view class="pd-poster-title">
            <text class="pd-brand">{{ DETAIL_NAV_TITLE }}</text>
            <text class="pd-poster-name">{{ name }}</text>
            <text v-if="product.slogan" class="pd-poster-slogan">
              {{ product.slogan }}
            </text>
          </view>

          <swiper
            v-if="posterImages.length > 0"
            class="pd-poster-swiper"
            :current="activeImage"
            :circular="false"
            @change="onDotChange"
          >
            <swiper-item v-for="(src, index) in posterImages" :key="index">
              <image class="pd-poster-image" :src="src" mode="aspectFill" />
            </swiper-item>
          </swiper>

          <view class="pd-info-bar">
            <text v-if="featureLine !== ''" class="pd-info-feature">
              {{ featureLine }}
            </text>
            <text class="pd-info-spec">{{ specLine }}</text>
          </view>
        </view>

        <!-- ② 图片分页点（1 张时隐藏） -->
        <view v-if="showDots" class="pd-dots">
          <view
            v-for="(src, index) in posterImages"
            :key="index"
            class="pd-dot"
            :class="{ 'pd-dot--active': index === activeImage }"
          />
        </view>

        <!-- ③ 产品基本信息 + 操作组 -->
        <view class="pd-basic">
          <text class="pd-name">{{ name }}</text>
          <text class="pd-model">{{ modelLine }}</text>

          <view class="pd-actions">
            <button class="pd-action pd-action-hit" open-type="share">
              <Icon name="share" :size="24" :color="ACTION_ICON_COLOR" />
              <text class="pd-action-label">{{ SHARE_LABEL }}</text>
            </button>

            <view class="pd-action pd-action-hit" @tap="onOpenQr">
              <Icon name="qr-code" :size="24" :color="ACTION_ICON_COLOR" />
              <text class="pd-action-label">{{ QR_LABEL }}</text>
            </view>

            <view class="pd-select-hit" @tap="onSelect">
              <view class="pd-select-circle">
                <text class="pd-select-circle-text">{{ SELECT_LABEL }}</text>
              </view>
              <text class="pd-action-label">{{ SELECT_LABEL }}</text>
            </view>
          </view>
        </view>

        <!-- ④ 区域分隔 -->
        <view class="pd-divider" />

        <!-- ⑤ 产品详情 -->
        <view class="pd-detail">
          <view class="pd-tabs">
            <view
              v-for="tab in DETAIL_TABS"
              :key="tab.key"
              class="pd-tab"
              :class="activeTab === tab.key ? 'pd-tab--active' : ''"
              @tap="onTabTap(tab.key)"
            >
              <text class="pd-tab-text">{{ tab.label }}</text>
            </view>
          </view>

          <template v-if="activeTab === 'detail'">
            <image
              v-if="detailImage !== ''"
              class="pd-detail-image"
              :src="detailImage"
              mode="aspectFill"
            />
            <view class="pd-desc">
              <rich-text
                v-if="detailContent !== ''"
                class="pd-rich"
                :nodes="detailContent"
              />
              <text v-else class="pd-desc-body">{{ EMPTY_DETAIL_TEXT }}</text>
              <text class="pd-desc-disclaimer">{{ DETAIL_DISCLAIMER }}</text>
            </view>
          </template>

          <template v-else>
            <template v-if="realImages.length > 0">
              <image
                v-for="(src, index) in realImages"
                :key="index"
                class="pd-detail-image"
                :src="src"
                mode="aspectFill"
              />
            </template>
            <text v-else class="pd-desc-body">{{ EMPTY_REAL_TEXT }}</text>
          </template>
        </view>
      </template>
    </scroll-view>

    <!-- 小程序码弹层（Q8 DEFERRED：无设计稿，最小可用实现） -->
    <view v-if="qrOpen" class="pd-mask" @tap="onCloseQr">
      <view class="pd-qr" @tap.stop="noop">
        <view class="pd-qr-head">
          <text class="pd-qr-title">{{ QR_LABEL }}</text>
          <view class="pd-qr-close" @tap="onCloseQr">
            <text class="pd-qr-close-text">×</text>
          </view>
        </view>
        <view class="pd-qr-box">
          <Icon name="qr-code" :size="72" :color="ACTION_ICON_COLOR" />
        </view>
        <text class="pd-qr-hint">请使用微信扫一扫查看产品</text>
      </view>
    </view>

    <view class="pd-tabbar">
      <TabBar variant="two" :active="-1" />
      <SafeArea />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pd-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: $color-text-inv;
}

.pd-scroll {
  flex: 1;
  height: 0;
}

/* ---------------- ① 产品介绍海报 ---------------- */
.pd-poster {
  overflow: hidden;
  border-radius: $radius-8;
  background-color: $color-cream;
}

.pd-poster-title {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  padding: $space-16;
}

.pd-brand {
  font-family: $font-family-en;
  font-size: $font-10;
  font-weight: $font-weight-bold;
  line-height: $line-height-10;
  letter-spacing: 1px;
  color: $color-navy;
}

.pd-poster-name {
  font-family: $font-family-cn;
  font-size: $font-23;
  font-weight: $font-weight-bold;
  line-height: $line-height-23;
  color: $color-navy;
}

.pd-poster-slogan {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-2;
}

.pd-poster-swiper {
  width: 100%;
  height: 190px;
}

.pd-poster-image {
  width: 100%;
  height: 190px;
}

.pd-info-bar {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  padding: $space-12 $space-16;
  background-color: $color-yellow-bg;
}

.pd-info-feature {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-medium;
  line-height: $line-height-11;
  color: $color-text-1;
}

.pd-info-spec {
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-text-2;
}

/* ---------------- ② 分页点（h20 居中 gap5） ---------------- */
.pd-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $space-5;
  height: 20px;
}

.pd-dot {
  width: 6px;
  height: 6px;
  border-radius: $radius-pill;
  background-color: $color-line;
}

.pd-dot--active {
  background-color: $color-navy;
}

/* ---------------- ③ 基本信息（p16 gap6） ---------------- */
.pd-basic {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  padding: $space-16;
}

.pd-name {
  font-family: $font-family-cn;
  font-size: $font-19;
  font-weight: $font-weight-bold;
  line-height: $line-height-19;
  color: $color-text-1;
}

.pd-model {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13;
  color: $color-text-3;
}

/* 操作组：pt12 gap20 右对齐 */
.pd-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $space-20;
  padding-top: $space-12;
}

/* Q13 热区先行：视觉不变，热区 ≥44×44（透明 padding 由 min 尺寸承载） */
.pd-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-4;
  padding: 0;
  margin: 0;
  border: none;
  background-color: transparent;
  line-height: normal;
}

.pd-action::after {
  border: none;
}

.pd-action-hit {
  min-width: 44px;
  min-height: 44px;
}

.pd-action-label {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-2;
  white-space: nowrap;
}

.pd-select-hit {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-4;
  min-width: 52px;
  min-height: 44px;
}

.pd-select-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: $radius-26;
  background-color: $color-yellow;
  box-shadow: $shadow-fab;
}

.pd-select-circle-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-medium;
  line-height: $line-height-13-fixed;
  color: $color-navy;
}

/* ---------------- ④ 区域分隔 ---------------- */
.pd-divider {
  width: 100%;
  height: 10px;
  background-color: $color-fill;
}

/* ---------------- ⑤ 产品详情（p16 gap20） ---------------- */
.pd-detail {
  display: flex;
  flex-direction: column;
  gap: $space-20;
  padding: $space-16;
}

.pd-tabs {
  display: flex;
  align-items: center;
  gap: $space-10;
}

.pd-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 calc(#{$space-12} + #{$space-2});
  border-radius: $radius-6;
  background-color: $color-fill;
}

.pd-tab--active {
  background-color: $color-navy;
}

.pd-tab-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13-fixed;
  color: $color-text-2;
}

.pd-tab--active .pd-tab-text {
  color: $color-text-inv;
}

.pd-detail-image {
  width: 100%;
  height: 180px;
}

.pd-desc {
  display: flex;
  flex-direction: column;
  gap: $space-10;
}

.pd-rich {
  font-family: $font-family-cn;
  font-size: $font-13;
  line-height: $line-height-13;
  color: $color-text-2;
}

.pd-desc-body {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13;
  color: $color-text-2;
}

.pd-desc-disclaimer {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-3;
}

/* ---------------- 状态（加载 / 错误） ---------------- */
.pd-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-12;
  padding: $space-60 $space-16;
}

.pd-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  color: $color-text-3;
  text-align: center;
}

.pd-state-back,
.pd-state-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 $space-16;
  border-radius: $radius-pill;
  background-color: $color-yellow;
}

.pd-state-back-text,
.pd-state-retry-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-semibold;
  color: $color-navy;
}

/* ---------------- 小程序码弹层 ---------------- */
.pd-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 950;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(26, 34, 96, 0.45);
}

.pd-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-16;
  width: 260px;
  padding: $space-20;
  box-sizing: border-box;
  border-radius: $radius-12;
  background-color: $color-text-inv;
}

.pd-qr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.pd-qr-title {
  font-family: $font-family-cn;
  font-size: $font-15;
  font-weight: $font-weight-bold;
  color: $color-text-1;
}

.pd-qr-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.pd-qr-close-text {
  font-size: $font-19;
  line-height: 1;
  color: $color-text-3;
}

.pd-qr-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160px;
  height: 160px;
  border-radius: $radius-8;
  background-color: $color-fill;
}

.pd-qr-hint {
  font-family: $font-family-cn;
  font-size: $font-12;
  line-height: $line-height-12;
  color: $color-text-2;
}

/* ---------------- 底部 TabBar two + 安全区 ---------------- */
.pd-tabbar {
  flex-shrink: 0;
  background-color: $color-text-inv;
}
</style>
