<script setup lang="ts">
import { PRODUCT_LIST_TAB, SELECTION_PAGE } from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";

const store = useSelectionStore();

function goSelection(): void {
  // 目标页 /pages/scheme/selection 由 MP-05 落地；此前回退到产品列表 tab（选品发生地）
  uni.navigateTo({
    url: SELECTION_PAGE,
    fail: () => {
      uni.switchTab({ url: PRODUCT_LIST_TAB });
    },
  });
}
</script>

<template>
  <view class="select-fab" @tap="goSelection">
    <text class="fab-label">选款</text>
    <view v-if="store.selectedCount > 0" class="fab-badge">
      {{ store.selectedCount > 99 ? "99+" : store.selectedCount }}
    </view>
  </view>
</template>

<style scoped>
.select-fab {
  position: fixed;
  right: 32rpx;
  bottom: 180rpx;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background-color: #f7c400;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
}

.fab-label {
  font-size: 14rpx;
  line-height: 1;
  color: #1a2260;
}

.fab-badge {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  min-width: 24rpx;
  height: 24rpx;
  padding: 0 4rpx;
  box-sizing: border-box;
  border-radius: 12rpx;
  background-color: #1a2260;
  color: #ffffff;
  font-size: 16rpx;
  line-height: 24rpx;
  text-align: center;
}
</style>