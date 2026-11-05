<script setup lang="ts">
import { onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import { useProductFilterStore } from "@/stores/useProductFilterStore";

const filterStore = useProductFilterStore();
const requestedCategoryId = ref<number | null>(null);

// 首页分类宫格 / jump_type=2 banner 经 Pinia 传入的分类筛选（MP-03 消费并实现列表）
onShow(() => {
  requestedCategoryId.value = filterStore.requestedCategoryId;
});
</script>

<template>
  <view class="page">
    <view class="placeholder">
      <text class="title">产品中心（占位）</text>
      <text class="subtitle">MP-03 实现搜索 / 侧分类 / 排序 / 选品</text>
      <text v-if="requestedCategoryId !== null" class="pending-category">
        已接收分类筛选 category_id={{ requestedCategoryId }}（MP-03 实现列表）
      </text>
    </view>
    <SelectFab />
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40rpx;
  box-sizing: border-box;
  background-color: #fdfbf5;
}

.placeholder {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 64rpx 32rpx;
  border-radius: 16rpx;
  background-color: #ffffff;
}

.title {
  font-size: 40rpx;
  font-weight: 600;
  color: #1e2330;
}

.subtitle {
  font-size: 26rpx;
  color: #8a90a3;
}

.pending-category {
  font-size: 26rpx;
  color: #1a2260;
}
</style>
