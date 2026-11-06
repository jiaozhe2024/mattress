<script setup lang="ts">
import type { Product } from "@/types/product";
import { absoluteUrl } from "@/utils/url";

defineProps<{
  products: Product[];
}>();

const emit = defineEmits<{
  (event: "remove", productId: number): void;
  (event: "ok"): void;
}>();

function onRemove(productId: number): void {
  emit("remove", productId);
}

function onOk(): void {
  emit("ok");
}
</script>

<template>
  <view class="sel-bar">
    <view class="sel-bar-main">
      <text class="sel-bar-count">已选 {{ products.length }} 款</text>
      <scroll-view class="sel-bar-thumbs" scroll-x :show-scrollbar="false">
        <view class="sel-bar-track">
          <view
            v-for="product in products"
            :key="product.id"
            class="sel-bar-thumb"
          >
            <image
              class="sel-bar-thumb-image"
              :src="absoluteUrl(product.main_image)"
              mode="aspectFill"
            />
            <view class="sel-bar-thumb-remove" @tap="onRemove(product.id)">
              <text class="sel-bar-thumb-remove-icon">×</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>
    <view class="sel-bar-ok" @tap="onOk">
      <text class="sel-bar-ok-text">OK</text>
    </view>
  </view>
</template>

<style scoped>
.sel-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 998;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background-color: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(30, 35, 48, 0.08);
}

.sel-bar-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  overflow: hidden;
}

.sel-bar-count {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a2260;
}

.sel-bar-thumbs {
  width: 100%;
  white-space: nowrap;
}

.sel-bar-track {
  display: inline-flex;
  gap: 16rpx;
  padding: 12rpx 4rpx 4rpx;
}

.sel-bar-thumb {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  border-radius: 12rpx;
  background-color: #eef0f6;
}

.sel-bar-thumb-image {
  width: 88rpx;
  height: 88rpx;
  border-radius: 12rpx;
}

.sel-bar-thumb-remove {
  position: absolute;
  top: -12rpx;
  right: -12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background-color: #1e2330;
}

.sel-bar-thumb-remove-icon {
  font-size: 22rpx;
  line-height: 1;
  color: #ffffff;
}

.sel-bar-ok {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 120rpx;
  height: 72rpx;
  border-radius: 999rpx;
  background-color: #f7c400;
}

.sel-bar-ok-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a2260;
}
</style>
