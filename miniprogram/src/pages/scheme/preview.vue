<script setup lang="ts">
/**
 * 预览分享页（MP-05D，V3 二级页 §5.9）
 *
 * 真值来源：docs/design/references/plan-05-preview-share.png +
 * design-spec/spec.md §5.9 + open-questions.md Q12（跳过版本条）。
 *
 * 结构：微信导航（二级页）→ 方案标题 → 分享产品海报列表 → 底部双按钮 → 安全区。
 * 数据：先按 token 拉 owner 详情；失败（无登录/非本人/不存在）回落 public 只读接口。
 * 核心约定 10：海报内容一律读 product_snapshot，不回查实时产品。
 */
import { onLoad, onShareAppMessage } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getPublicScheme, getSchemeDetail, shareScheme } from "@/api/scheme";
import type { WxSchemeProduct } from "@/api/scheme";
import {
  PREVIEW_BACK_LABEL,
  PREVIEW_BRAND,
  PREVIEW_EMPTY_TEXT,
  PREVIEW_ERROR_TEXT,
  PREVIEW_FEATURE_TEXT,
  PREVIEW_FOOTNOTE,
  PREVIEW_LOADING_TEXT,
  PREVIEW_NAV_TITLE,
  PREVIEW_SHARE_FAILED_TOAST,
  PREVIEW_SHARE_LABEL,
  previewSharePathOf,
  previewShareTitleOf,
  previewViewsOf,
  type PreviewProductView,
} from "@/components/scheme/schemePreviewModel";
import { absoluteUrl } from "@/utils/url";

type PageStatus = "loading" | "ready" | "error";

const schemeId = ref<number | null>(null);
const title = ref("");
const products = ref<WxSchemeProduct[]>([]);
const status = ref<PageStatus>("loading");
/** 访客态：无登录或非本人 → 只读，不显示「返回编辑」入口。 */
const isVisitor = ref(false);

const views = computed((): PreviewProductView[] => previewViewsOf(products.value));
const isEmpty = computed(
  (): boolean => status.value === "ready" && views.value.length === 0
);

function parseId(raw: unknown): number {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : Number.NaN;
}

async function load(): Promise<void> {
  const id = schemeId.value;
  if (id === null || Number.isNaN(id)) {
    status.value = "error";
    return;
  }
  status.value = "loading";
  // 先试 owner 详情（拿到完整快照）；失败回落 public 只读
  try {
    const detail = await getSchemeDetail(id);
    title.value = detail.title;
    products.value = detail.products;
    isVisitor.value = false;
    status.value = "ready";
    return;
  } catch {
    /* 落 public */
  }
  try {
    const publicScheme = await getPublicScheme(id);
    title.value = publicScheme.title;
    products.value = publicScheme.products;
    isVisitor.value = true;
    status.value = "ready";
  } catch {
    status.value = "error";
  }
}

onLoad((options) => {
  schemeId.value = parseId(options?.id);
  void load();
});

/**
 * 返回按钮。
 *
 * spec §5.9 ③ 底栏只有「返回 / 立即分享」两个按钮，**没有「返回编辑」**，
 * 所以访客态与本人态的底栏视觉一致（这正是设计意图：访客只读、无编辑入口）。
 *
 * 差异只体现在回退目标：
 * - 本人（从编辑页/列表进入）→ navigateBack 回上一页
 * - 访客（从分享卡片冷启动，无上一页）→ 回落首页
 */
function onBack(): void {
  if (isVisitor.value) {
    uni.reLaunch({ url: "/pages/index/index" });
    return;
  }
  uni.navigateBack({
    fail: () => {
      uni.reLaunch({ url: "/pages/index/index" });
    },
  });
}

/** 转发内容：path 带 id，好友打开走 public 只读。 */
onShareAppMessage((res) => {
  const id = schemeId.value;
  if (id !== null && !Number.isNaN(id)) {
    // 分享成功后计数 +1（后端幂等失败不影响转发本身）
    void shareScheme(id).catch(() => {
      uni.showToast({ title: PREVIEW_SHARE_FAILED_TOAST, icon: "none" });
    });
  }
  return {
    title: previewShareTitleOf(title.value),
    path:
      id !== null && !Number.isNaN(id)
        ? previewSharePathOf(id)
        : "/pages/index/index",
  };
});
</script>

<template>
  <view class="sp-page">
    <scroll-view class="sp-scroll" scroll-y :show-scrollbar="false">
      <!-- 加载 / 错误 / 空 -->
      <view v-if="status === 'loading'" class="sp-state">
        <text class="sp-state-text">{{ PREVIEW_LOADING_TEXT }}</text>
      </view>
      <view v-else-if="status === 'error'" class="sp-state">
        <text class="sp-state-text">{{ PREVIEW_ERROR_TEXT }}</text>
      </view>
      <view v-else-if="isEmpty" class="sp-state">
        <text class="sp-state-text">{{ PREVIEW_EMPTY_TEXT }}</text>
      </view>

      <template v-else>
        <!-- ① 方案标题：Medium 21 text1 行高 1.45 居中 -->
        <view class="sp-title-wrap">
          <text class="sp-title">{{ title }}</text>
        </view>

        <!-- ② 分享产品列表：bg fill p16 gap12 -->
        <view class="sp-list">
          <view v-for="view in views" :key="view.key" class="sp-card">
            <!-- 产品介绍海报：bg cream 圆角 8 -->
            <view class="sp-poster">
              <view class="sp-poster-head">
                <text class="sp-brand">{{ PREVIEW_BRAND }}</text>
                <text class="sp-name">{{ view.name }}</text>
                <text v-if="view.sellingPoint !== ''" class="sp-selling">
                  {{ view.sellingPoint }}
                </text>
              </view>

              <image
                v-if="view.mainImage !== ''"
                class="sp-image"
                :src="absoluteUrl(view.mainImage)"
                mode="aspectFill"
              />
              <view v-else class="sp-image sp-image--fallback" />

              <!-- 产品信息条：bg yellowBg px16 py12 gap6 -->
              <view class="sp-info">
                <text class="sp-feature">{{ PREVIEW_FEATURE_TEXT }}</text>
                <text v-if="view.specLine !== ''" class="sp-spec">
                  {{ view.specLine }}
                </text>
              </view>
            </view>

            <!-- 产品底注：px8 py12 -->
            <view class="sp-footnote-wrap">
              <text class="sp-footnote">{{ PREVIEW_FOOTNOTE }}</text>
            </view>
          </view>
        </view>
      </template>
    </scroll-view>

    <!-- ③ 底部操作条：bg navy p14 gap12 -->
    <view v-if="status === 'ready' && !isEmpty" class="sp-actions">
      <view class="sp-action sp-action--secondary" @tap="onBack">
        <text class="sp-action-text sp-action-text--secondary">
          {{ PREVIEW_BACK_LABEL }}
        </text>
      </view>
      <button class="sp-action sp-action--primary" open-type="share">
        <text class="sp-action-text sp-action-text--primary">
          {{ PREVIEW_SHARE_LABEL }}
        </text>
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.sp-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: $color-text-inv;
}

.sp-scroll {
  flex: 1;
  min-height: 0;
}

.sp-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $space-60 $space-16;
  box-sizing: border-box;
}

.sp-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13;
  color: $color-text-3;
  text-align: center;
}

/* ① 方案标题：p20，Medium 21 text1 行高 1.45 居中 */
.sp-title-wrap {
  padding: $space-20;
  box-sizing: border-box;
}

.sp-title {
  display: block;
  font-family: $font-family-cn;
  font-size: $font-21;
  font-weight: $font-weight-medium;
  line-height: $line-height-21;
  color: $color-text-1;
  text-align: center;
}

/* ② 分享产品列表：bg fill p16 gap12 */
.sp-list {
  display: flex;
  flex-direction: column;
  gap: $space-12;
  padding: $space-16;
  box-sizing: border-box;
  background-color: $color-fill;
}

/* 分享产品卡：白底圆角 8 p8 纵向 */
.sp-card {
  display: flex;
  flex-direction: column;
  padding: $space-8;
  box-sizing: border-box;
  border-radius: $radius-8;
  background-color: $color-text-inv;
}

/* 产品介绍海报：bg cream 圆角 8 */
.sp-poster {
  overflow: hidden;
  border-radius: $radius-8;
  background-color: $color-cream;
}

/* 产品标题：p16 gap6 */
.sp-poster-head {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  padding: $space-16;
  box-sizing: border-box;
}

/* 品牌行 Inter Bold 10 navy 字距 1 */
.sp-brand {
  font-family: $font-family-en;
  font-size: $font-10;
  font-weight: $font-weight-bold;
  line-height: $line-height-10;
  letter-spacing: 1px;
  color: $color-navy;
}

/* 产品名 Bold 23 navy */
.sp-name {
  font-family: $font-family-cn;
  font-size: $font-23;
  font-weight: $font-weight-bold;
  line-height: $line-height-23;
  color: $color-navy;
}

/* 卖点 Regular 11 text2 行高 1.45 */
.sp-selling {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-2;
}

/* 床垫产品图 h190 object-cover */
.sp-image {
  display: block;
  width: 100%;
  height: 190px;
}

.sp-image--fallback {
  background-color: $color-cream;
}

/* 产品信息：bg yellowBg px16 py12 gap6 */
.sp-info {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  padding: $space-12 $space-16;
  box-sizing: border-box;
  background-color: $color-yellow-bg;
}

/* feature 行 Medium 11 text1 */
.sp-feature {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-medium;
  line-height: $line-height-11;
  color: $color-text-1;
}

/* 规格行 Regular 10 text2 */
.sp-spec {
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-text-2;
}

/* 产品底注：px8 py12 */
.sp-footnote-wrap {
  padding: $space-12 $space-8;
  box-sizing: border-box;
}

/* 底注 Regular 11 text3 行高 1.45 */
.sp-footnote {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-3;
}

/* ③ 底部操作条：bg navy p14 gap12 */
/* ③ 底部操作条：bg navy p14 gap12（下缘含原生安全区） */
.sp-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: $space-12;
  padding: $space-14;
  padding-bottom: calc(#{$space-14} + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background-color: $color-navy;
}

.sp-action {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  padding: $space-12 $space-8;
  border-radius: $radius-20;
  box-sizing: border-box;
}

.sp-action--secondary {
  border: 1px solid $color-navy-50;
  background-color: $color-text-inv;
}

.sp-action--primary {
  background-color: $color-yellow;
}

.sp-action-text {
  font-family: $font-family-cn;
  font-weight: $font-weight-medium;
}

/* 返回：Medium 14 text2 行高 20 */
.sp-action-text--secondary {
  font-size: $font-14;
  line-height: $line-height-14-fixed;
  color: $color-text-2;
}

/* 立即分享：Medium 15 navy 行高 22 */
.sp-action-text--primary {
  font-size: $font-15;
  line-height: $line-height-15-fixed;
  color: $color-navy;
}
</style>
