<template>
  <view class="page">
    <view class="placeholder">
      <text class="title">我的（占位）</text>
      <text class="subtitle">MP-06 实现品牌介绍 / 招商加盟 / 客服承诺</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40rpx;
  box-sizing: border-box;
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
  color: #333333;
}

.subtitle {
  font-size: 26rpx;
  color: #999999;
}
</style>