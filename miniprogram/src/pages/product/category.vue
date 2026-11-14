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
import { onLoad, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getCategories } from "@/api/product";
import WechatNav from "@/components/frame/WechatNav.vue";
import SelectFab from "@/components/frame/SelectFab.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  CATEGORY_BANNER,
  CATEGORY_CHEVRON_COLOR,
  categoryEntryViewsOf,
  productListUrlOf,
  type CategoryEntryView,
} from "@/components/category/categoryModel";
import { PRODUCT_LIST_PAGE } from "@/config";
import { useProductFilterStore } from "@/stores/useProductFilterStore";
import type { WxCategory } from "@/types/home";
import { absoluteUrl } from "@/utils/url";

type PageStatus = "loading" | "ready" | "error";

const filterStore = useProductFilterStore();

const status = ref<PageStatus>("loading");
const categories = ref<WxCategory[]>([]);
const failedImageIds = ref<number[]>([]);

const entries = computed(
  (): CategoryEntryView[] => categoryEntryViewsOf(categories.value, failedImageIds.value)
);

/** 防止转发跳转重入（navigateTo 失败时请求仍留在 Pinia，下次 onShow 会再试）。 */
let forwarding = false;

onLoad(() => {
  void loadCategories();
});

onShow(() => {
  forwardPendingFilterRequest();
});

/**
 * 兼容桥（MP-03A）：首页（MP-02，不改码）经 Pinia 传递分类/型号请求后 switchTab 到「产品」。
 * 产品 tab 自本任务起是分类页，故此处把请求转交给真正的产品列表页（普通页，可带参），
 * 保持「首页点系列卡 → 该分类产品」「首页点寝具 → 型号搜索」两条链路不变。
 * 请求由产品列表页 onShow 消费并清除，本页不清，失败可重试。
 */
function forwardPendingFilterRequest(): void {
  if (forwarding) return;
  const pendingCategoryId = filterStore.requestedCategoryId;
  const pendingKeyword = filterStore.requestedKeyword;
  if (pendingCategoryId === null && pendingKeyword === null) return;
  forwarding = true;
  const url =
    pendingCategoryId !== null
      ? productListUrlOf(pendingCategoryId)
      : PRODUCT_LIST_PAGE;
  uni.navigateTo({
    url,
    fail: () => {
      uni.showToast({ title: "产品列表打开失败", icon: "none" });
    },
    complete: () => {
      forwarding = false;
    },
  });
}

async function loadCategories(): Promise<void> {
  status.value = "loading";
  try {
    categories.value = await getCategories();
    status.value = "ready";
  } catch {
    categories.value = [];
    status.value = "error";
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
    <WechatNav title="乐卡思 LEKASI" />

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
        <view class="pc-state-retry" @tap="loadCategories">
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
          <Icon
            name="chevron-right"
            :size="20"
            :color="CATEGORY_CHEVRON_COLOR"
          />
        </view>
      </view>
    </view>

    <SelectFab />
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
  padding: $space-16 $space-16 90px;
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
