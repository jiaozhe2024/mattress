<script setup lang="ts">
import { computed } from "vue";
import type { WxProductListItem } from "@/types/product";
import { absoluteUrl } from "@/utils/url";

const props = defineProps<{
  product: WxProductListItem;
  mode: "grid" | "list";
  added: boolean;
}>();

const emit = defineEmits<{
  (event: "add", product: WxProductListItem): void;
  (event: "open", product: WxProductListItem): void;
}>();

/** 睡感字符串按常见分隔拆成标签（后端为自由文本，无分隔时单标签）。 */
const sleepFeelTags = computed((): string[] => {
  if (!props.product.sleep_feel) return [];
  return props.product.sleep_feel
    .split(/[、,，/|\s]+/)
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "")
    .slice(0, 3);
});

function onAdd(): void {
  emit("add", props.product);
}

function onOpen(): void {
  emit("open", props.product);
}
</script>

<template>
  <view
    class="pcard"
    :class="mode === 'list' ? 'pcard--list' : 'pcard--grid'"
    @tap="onOpen"
  >
    <view class="pcard-media">
      <view class="pcard-media-fallback">
        <text class="pcard-media-fallback-text">{{
          product.name.slice(0, 2)
        }}</text>
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
      <text class="pcard-model">{{ product.model }}</text>
      <text v-if="product.spec" class="pcard-spec">{{ product.spec }}</text>
      <view v-if="sleepFeelTags.length > 0" class="pcard-tags">
        <text v-for="tag in sleepFeelTags" :key="tag" class="pcard-tag">{{
          tag
        }}</text>
      </view>
      <view class="pcard-foot">
        <view
          class="pcard-add"
          :class="added ? 'pcard-add--added' : ''"
          @tap.stop="onAdd"
        >
          <text class="pcard-add-icon">{{ added ? "✓" : "+" }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.pcard {
  background-color: #ffffff;
  border-radius: 20rpx;
  overflow: hidden;
}

.pcard--grid {
  display: flex;
  flex-direction: column;
}

.pcard--list {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  padding: 20rpx;
}

.pcard-media {
  position: relative;
  width: 100%;
  height: 300rpx;
  background-color: #eef0f6;
  overflow: hidden;
}

.pcard--list .pcard-media {
  flex-shrink: 0;
  width: 220rpx;
  height: 220rpx;
  border-radius: 12rpx;
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

.pcard-media-fallback-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #8890b8;
}

.pcard-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.pcard-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  padding: 20rpx;
}

.pcard--list .pcard-info {
  padding: 0;
}

.pcard-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e2330;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.pcard-model {
  font-size: 22rpx;
  color: #8a90a3;
}

.pcard-spec {
  font-size: 22rpx;
  color: #8a90a3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pcard-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.pcard-tag {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background-color: #fff8e1;
  color: #1a2260;
  font-size: 20rpx;
}

.pcard-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  min-height: 56rpx;
}

.pcard-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background-color: #f7c400;
  margin-left: auto;
}

.pcard-add--added {
  background-color: #e3e5ec;
}

.pcard-add-icon {
  font-size: 32rpx;
  line-height: 1;
  color: #1a2260;
}

.pcard-add--added .pcard-add-icon {
  color: #8a90a3;
}
</style>
