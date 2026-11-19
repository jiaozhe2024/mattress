<script setup lang="ts">
/**
 * 产品分类列表页（MP-03A，V3 新页；接管 tabBar「产品」位）
 *
 * 真值来源：docs/design/references/product-category.png + design-spec/spec.md §5.2 +
 * open-questions.md Q12（不实现版本条）/ Q15（8 分类 + banner_image 优先）。
 * 结构：微信导航 → 系列横幅 → 8 分类入口 → 原生 TabBar（产品选中）→ 选款 FAB。
 *
 * 数据：GET /wxapi/categories（BE-10 八分类，banner_image 本轮为 null 走文字通道）。
 * 点击分类 → navigateTo 产品列表页并带 category_id（产品列表已降为普通页）。
 */
import { onLoad, onPageScroll, onPullDownRefresh, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getCategories } from "@/api/product";
import SelectFab from "@/components/frame/SelectFab.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  CATEGORY_BANNER,
  CATEGORY_CHEVRON_COLOR,
  categoryEntryViewsOf,
  productListUrlOf,
  type CategoryEntryView,
} from "@/components/category/categoryModel";
import type { WxCategory } from "@/types/home";
import { absoluteUrl } from "@/utils/url";

type PageStatus = "loading" | "ready" | "error";

const status = ref<PageStatus>("loading");
const categories = ref<WxCategory[]>([]);
const failedImageIds = ref<number[]>([]);

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

const entries = computed(
  (): CategoryEntryView[] => categoryEntryViewsOf(categories.value, failedImageIds.value)
);

onLoad(() => {
  void loadCategories();
});

onPullDownRefresh(() => {
  // 刷新不切 loading 态：保留已渲染分类，避免整页闪烁
  void loadCategories({ isRefresh: true });
});

async function loadCategories(
  options: { isRefresh?: boolean } = {}
): Promise<void> {
  const isRefresh = options.isRefresh === true;
  if (!isRefresh) status.value = "loading";
  try {
    categories.value = await getCategories();
    status.value = "ready";
  } catch {
    if (!isRefresh) {
      categories.value = [];
      status.value = "error";
    }
  } finally {
    if (isRefresh) uni.stopPullDownRefresh();
  }
}

function onEntryTap(entry: CategoryEntryView): void {
  uni.navigateTo({
    url: productListUrlOf(entry.id),
    fail: () => {
      uni.showToast({ title: "产品列表打开失败", icon: "none" });
    },
  });
}

function onEntryImageError(categoryId: number): void {
  if (!failedImageIds.value.includes(categoryId)) {
    failedImageIds.value = [...failedImageIds.value, categoryId];
  }
}
</script>

<template>
  <view class="pc-page">
    <view class="pc-body">
      <!-- ① 系列横幅 -->
      <view class="pc-banner">
        <view class="pc-banner-text">
          <text class="pc-banner-brand">{{ CATEGORY_BANNER.brand }}</text>
          <text class="pc-banner-title">{{ CATEGORY_BANNER.title }}</text>
          <text class="pc-banner-subtitle">{{ CATEGORY_BANNER.subtitle }}</text>
        </view>
        <view class="pc-banner-media">
          <image
            class="pc-banner-image"
            :src="CATEGORY_BANNER.image"
            mode="aspectFill"
          />
        </view>
      </view>

      <!-- ② 分类入口（8 项；banner_image 优先，空则文字降级） -->
      <view v-if="status === 'loading'" class="pc-state">
        <text class="pc-state-text">加载中…</text>
      </view>
      <view v-else-if="status === 'error'" class="pc-state">
        <text class="pc-state-text">分类加载失败</text>
        <view class="pc-state-retry" @tap="loadCategories()">
          <text class="pc-state-retry-text">重试</text>
        </view>
      </view>
      <view v-else-if="entries.length === 0" class="pc-state">
        <text class="pc-state-text">暂无分类</text>
      </view>
      <view v-else class="pc-entries">
        <view
          v-for="entry in entries"
          :key="entry.id"
          class="pc-entry"
          :data-category-id="entry.id"
          @tap="onEntryTap(entry)"
        >
          <view v-if="entry.imageSrc" class="pc-entry-media">
            <image
              class="pc-entry-image"
              :src="absoluteUrl(entry.imageSrc)"
              mode="aspectFit"
              lazy-load
              @error="onEntryImageError(entry.id)"
            />
          </view>
          <view v-else class="pc-entry-text">
            <text class="pc-entry-title">{{ entry.title }}</text>
            <text v-if="entry.subtitle !== ''" class="pc-entry-subtitle">{{
              entry.subtitle
            }}</text>
          </view>
          <!-- data-icon 供 e2e 断言：Icon 是自定义组件，内部 .icon--chevron-right
               在页面侧不可见（IDE 2.x automator 不穿透组件边界）。 -->
          <Icon
            name="chevron-right"
            :size="20"
            :color="CATEGORY_CHEVRON_COLOR"
            :data-icon="'chevron-right'"
          />
        </view>
      </view>
    </view>

    <view class="select-fab-host"
      ><SelectFab class="select-fab-anchor" :scrolling="isScrolling"
    /></view>
  </view>
</template>

<style lang="scss" scoped>
.pc-page {
  position: relative;
  min-height: 100vh;
  box-sizing: border-box;
  background-color: $color-cream;
}

.pc-body {
  display: flex;
  flex-direction: column;
  gap: $space-12;
  /* 底部留白：内容不被原生 TabBar 与选款 FAB 遮挡 */
  padding: $space-16 $space-16 $space-fab-bottom;
}

/* ---------------- ① 系列横幅 ---------------- */
.pc-banner {
  overflow: hidden;
  border-radius: $radius-12;
  background-color: $color-navy;
}

.pc-banner-text {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  padding: $space-18;
  box-sizing: border-box;
}

.pc-banner-brand {
  font-family: $font-family-en;
  font-size: $font-12;
  font-weight: $font-weight-bold;
  line-height: 1;
  letter-spacing: 1px;
  color: $color-yellow;
}

.pc-banner-title {
  font-family: $font-family-cn;
  font-size: $font-21;
  font-weight: $font-weight-bold;
  line-height: $line-height-21;
  color: $color-text-inv;
}

.pc-banner-subtitle {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-inv;
}

.pc-banner-media {
  width: 100%;
  height: 120px;
  overflow: hidden;
}

.pc-banner-image {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---------------- ② 分类入口 ---------------- */
.pc-entries {
  display: flex;
  flex-direction: column;
  gap: $space-12;
}

.pc-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $space-12;
  height: 90px;
  padding: 0 $space-20;
  box-sizing: border-box;
  border-radius: $radius-8;
  background-color: $color-text-inv;
}

.pc-entry-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space-6;
  min-width: 0;
}

.pc-entry-title {
  font-family: $font-family-cn;
  font-size: $font-19;
  font-weight: $font-weight-bold;
  line-height: $line-height-19;
  color: $color-navy;
}

.pc-entry-subtitle {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-3;
}

/* 图片通道：占满入口左侧内容区，保持比例不拉伸（aspectFit） */
.pc-entry-media {
  flex: 1;
  height: 90px;
  min-width: 0;
}

.pc-entry-image {
  display: block;
  width: 100%;
  height: 100%;
}

/* ---------------- 状态（加载/错误/空） ---------------- */
.pc-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-12;
  padding: $space-60 $space-16;
}

.pc-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  color: $color-text-3;
  text-align: center;
}

.pc-state-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 21px;
  padding: 0 $space-16;
  border-radius: $radius-pill;
  background-color: $color-yellow;
}

.pc-state-retry-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-semibold;
  color: $color-navy;
}
</style>
