<script setup lang="ts">
/**
 * 方案列表页（MP-05C，V3 二级页 §5.8）
 *
 * 真值来源：docs/design/references/plan-04-list.png + design-spec/spec.md §5.8 +
 * open-questions.md Q8（空态空白不插图 / 删除用系统 modal）/ Q9（日期动态格式化）/
 * Q12（跳过版本条）。
 *
 * 结构：微信导航（二级页）→ 方案卡片列表 → 底部提示 → 安全区。
 * 本页无固定操作条、无 TabBar（spec §5.8 ②）。
 */
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { deleteScheme, getSchemes } from "@/api/scheme";
import type { WxSchemeListItem } from "@/api/scheme";
import SafeArea from "@/components/frame/SafeArea.vue";
import WechatNav from "@/components/frame/WechatNav.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  DELETE_CONFIRM_CONTENT,
  DELETE_CONFIRM_TITLE,
  DELETE_FAILED_TOAST,
  DELETE_SUCCESS_TOAST,
  LIST_BOTTOM_HINT,
  LIST_EMPTY_TEXT,
  LIST_ERROR_TEXT,
  LIST_NAV_TITLE,
  schemeCardViewsOf,
  type SchemeCardView,
} from "@/components/scheme/schemeListModel";
import { SCHEME_EDIT_PAGE } from "@/config";
import { absoluteUrl } from "@/utils/url";

/** 图标色镜像 token（Icon 的 color 进 SVG data URI，取不到 CSS 变量）。 */
const ICON_COLOR = "#8a90a3";

type PageStatus = "loading" | "ready" | "error";

const items = ref<WxSchemeListItem[]>([]);
const status = ref<PageStatus>("loading");
const deleting = ref(false);

const cards = computed((): SchemeCardView[] => schemeCardViewsOf(items.value));
const isReady = computed((): boolean => status.value === "ready");
const isEmpty = computed((): boolean => isReady.value && cards.value.length === 0);

async function loadSchemes(): Promise<void> {
  status.value = "loading";
  try {
    const page = await getSchemes(1, 50);
    items.value = page.items;
    status.value = "ready";
  } catch {
    items.value = [];
    status.value = "error";
  }
}

// 从编辑页保存后返回时需刷新（onShow 而非 onLoad）
onShow(() => {
  void loadSchemes();
});

function onRetry(): void {
  void loadSchemes();
}

/** 点卡片 → 方案编辑页（带 id）。 */
function onCardTap(card: SchemeCardView): void {
  uni.navigateTo({
    url: `${SCHEME_EDIT_PAGE}?id=${card.id}`,
    fail: () => {
      uni.showToast({ title: "方案编辑页暂不可用", icon: "none" });
    },
  });
}

/** 长按 → 系统确认弹窗 → 软删除（Q8：弹窗未设计，用 uni.showModal）。 */
function onCardLongPress(card: SchemeCardView): void {
  if (deleting.value) return;
  uni.showModal({
    title: DELETE_CONFIRM_TITLE,
    content: DELETE_CONFIRM_CONTENT,
    confirmText: "删除",
    confirmColor: "#e5573d",
    cancelText: "取消",
    success: (res) => {
      if (res.confirm) {
        void performDelete(card.id);
      }
    },
  });
}

async function performDelete(id: number): Promise<void> {
  if (deleting.value) return;
  deleting.value = true;
  try {
    await deleteScheme(id);
    uni.showToast({ title: DELETE_SUCCESS_TOAST, icon: "none" });
    items.value = items.value.filter((item) => item.id !== id);
  } catch {
    uni.showToast({ title: DELETE_FAILED_TOAST, icon: "none" });
  } finally {
    deleting.value = false;
  }
}

/** 封面图绝对地址（cover_image 为服务端相对路径）。 */
function coverSrcOf(card: SchemeCardView): string {
  return card.coverImage === null ? "" : absoluteUrl(card.coverImage);
}
</script>

<template>
  <view class="sl-page">
    <WechatNav :title="LIST_NAV_TITLE" back />

    <scroll-view class="sl-scroll" scroll-y :show-scrollbar="false">
      <!-- 加载态 -->
      <view v-if="status === 'loading'" class="sl-state">
        <text class="sl-state-text">加载中…</text>
      </view>

      <!-- 错误态 -->
      <view v-else-if="status === 'error'" class="sl-state">
        <text class="sl-state-text">{{ LIST_ERROR_TEXT }}</text>
        <view class="sl-retry" @tap="onRetry">
          <text class="sl-retry-text">重试</text>
        </view>
      </view>

      <!-- 空态（Q8：空白区域，不做插图） -->
      <view v-else-if="isEmpty" class="sl-state">
        <text class="sl-state-text">{{ LIST_EMPTY_TEXT }}</text>
      </view>

      <!-- 方案列表 -->
      <view v-else class="sl-list">
        <view
          v-for="card in cards"
          :key="card.id"
          class="sl-card"
          @tap="onCardTap(card)"
          @longpress="onCardLongPress(card)"
        >
          <!-- 封面 88×96 圆角 6；无封面走占位层 -->
          <view class="sl-cover">
            <image
              v-if="coverSrcOf(card) !== ''"
              class="sl-cover-image"
              :src="coverSrcOf(card)"
              mode="aspectFill"
            />
            <view v-else class="sl-cover-fallback">
              <text class="sl-cover-initial">{{ card.title.slice(0, 1) }}</text>
            </view>
          </view>

          <view class="sl-info">
            <text class="sl-title">{{ card.title }}</text>
            <text class="sl-sub">{{ card.titleLine }}</text>
            <text class="sl-meta">{{ card.metaLine }}</text>
          </view>

          <view class="sl-chevron">
            <Icon name="chevron-right" :size="16" :color="ICON_COLOR" />
          </view>
        </view>

        <text class="sl-hint">{{ LIST_BOTTOM_HINT }}</text>
      </view>
    </scroll-view>

    <SafeArea />
  </view>
</template>

<style lang="scss" scoped>
.sl-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: $color-fill;
}

.sl-scroll {
  flex: 1;
  min-height: 0;
}

/* 三态（加载 / 错误 / 空）：居中留白，不做插图（Q8） */
.sl-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: $space-12;
  padding: $space-60 $space-16;
  box-sizing: border-box;
}

.sl-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13;
  color: $color-text-3;
  text-align: center;
}

.sl-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 0 $space-20;
  box-sizing: border-box;
  border-radius: $radius-18;
  background-color: $color-yellow;
}

.sl-retry-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-medium;
  line-height: $line-height-13;
  color: $color-navy;
}

/* 列表容器：bg fill p16 gap12 min-height 722 */
.sl-list {
  display: flex;
  flex-direction: column;
  gap: $space-12;
  min-height: 722px;
  padding: $space-16;
  box-sizing: border-box;
}

/* 方案卡片：白底圆角 8 p12 gap12 居中 */
.sl-card {
  display: flex;
  align-items: center;
  gap: $space-12;
  padding: $space-12;
  box-sizing: border-box;
  border-radius: $radius-8;
  background-color: $color-text-inv;
}

/* 封面 88×96 圆角 6 */
.sl-cover {
  flex-shrink: 0;
  width: 88px;
  height: 96px;
  overflow: hidden;
  border-radius: $radius-6;
  background-color: $color-cream;
}

.sl-cover-image {
  display: block;
  width: 100%;
  height: 100%;
}

.sl-cover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.sl-cover-initial {
  font-family: $font-family-cn;
  font-size: $font-19;
  font-weight: $font-weight-medium;
  line-height: $line-height-19;
  color: $color-navy-50;
}

/* 方案信息：自适应宽 gap7 行高 1.45 */
.sl-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space-7;
  min-width: 0;
}

/* 主标题 Medium 15 navy */
.sl-title {
  font-family: $font-family-cn;
  font-size: $font-15;
  font-weight: $font-weight-medium;
  line-height: $line-height-15;
  color: $color-navy;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 副行1 Regular 12 text2 */
.sl-sub {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 副行2 Regular 11 text3 */
.sl-meta {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sl-chevron {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

/* 底部提示：居中 11 text3 */
.sl-hint {
  padding-top: $space-4;
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-3;
  text-align: center;
}
</style>
