<script setup lang="ts">
/**
 * 产品卡（V3 产品页，MP-03B）
 *
 * 规格：references/product-list.png + design-spec/spec.md §5.3 ②
 *   - 卡 167×246、白底、圆角 12、shadow/card（宽度由页面网格列宽决定，不写死）
 *   - 主图 150 高 object-cover 贴顶
 *   - 内容区左 12 上 156，143×82：产品名 Medium 13 / 规格 Inter Regular 10 /
 *     标签行 h22（`舒适睡感` 72×22 + `查看详情` 58×20）
 *
 * 本卡只负责展示与「打开详情」；选品加入按钮属选品页 MP-05A 的小卡，不在本组件。
 */
import { computed } from "vue";
import {
  CARD_DETAIL_LABEL,
  sleepFeelTagOf,
} from "@/components/product/productListModel";
import type { WxProductListItem } from "@/types/product";
import { absoluteUrl } from "@/utils/url";

const props = defineProps<{
  product: WxProductListItem;
}>();

const emit = defineEmits<{
  (event: "open", product: WxProductListItem): void;
}>();

const sleepTag = computed((): string => sleepFeelTagOf(props.product));

const initial = computed((): string => props.product.name.slice(0, 2));

function onOpen(): void {
  emit("open", props.product);
}
</script>

<template>
  <view class="pcard" @tap="onOpen">
    <view class="pcard-media">
      <view class="pcard-media-fallback">
        <text class="pcard-media-initial">{{ initial }}</text>
      </view>
      <image
        v-if="product.main_image"
        class="pcard-image"
        :src="absoluteUrl(product.main_image)"
        mode="aspectFill"
        lazy-load
      />
    </view>
    <view class="pcard-info">
      <text class="pcard-name">{{ product.name }}</text>
      <text v-if="product.spec" class="pcard-spec">{{ product.spec }}</text>
      <view class="pcard-tag-row">
        <view v-if="sleepTag !== ''" class="pcard-feel">
          <text class="pcard-feel-text">{{ sleepTag }}</text>
        </view>
        <view class="pcard-detail" @tap.stop="onOpen">
          <text class="pcard-detail-text">{{ CARD_DETAIL_LABEL }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pcard {
  position: relative;
  height: 246px;
  overflow: hidden;
  border-radius: $radius-12;
  background-color: $color-text-inv;
  box-shadow: $shadow-card;
}

.pcard-media {
  position: relative;
  width: 100%;
  height: 150px;
  overflow: hidden;
  background-color: $color-fill;
}

.pcard-media-fallback {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.pcard-media-initial {
  font-family: $font-family-cn;
  font-size: $font-19;
  font-weight: $font-weight-medium;
  color: $color-navy-50;
}

.pcard-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 内容区：left12 top156，143×82（按稿绝对定位，避免行高累积偏差） */
.pcard-info {
  position: absolute;
  top: 156px;
  left: $space-12;
  width: 143px;
  height: 82px;
}

.pcard-name {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-medium;
  line-height: $line-height-13;
  color: $color-text-1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pcard-spec {
  position: absolute;
  top: 21px;
  left: 0;
  width: 100%;
  font-family: $font-family-en;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-text-3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pcard-tag-row {
  position: absolute;
  top: 38px;
  left: 0;
  display: flex;
  align-items: center;
  gap: $space-6;
  height: 22px;
}

.pcard-feel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 22px;
  border-radius: $radius-11;
  background-color: $color-yellow-soft;
}

.pcard-feel-text {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-medium;
  line-height: $line-height-16-fixed;
  color: $color-yellow-deep;
  white-space: nowrap;
}

.pcard-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 20px;
  border-radius: $radius-4;
  background-color: $color-fill;
}

.pcard-detail-text {
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-15-line;
  color: $color-text-3;
  white-space: nowrap;
}
</style>
