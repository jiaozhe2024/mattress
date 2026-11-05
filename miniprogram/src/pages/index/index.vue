<template>
  <view class="page">
    <view class="hero">
      <text class="title">床垫选品方案</text>
      <text class="subtitle">首页（占位）· MP-02 实现 Banner / 分类宫格 / 品牌服务</text>
    </view>
    <SelectFab />
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40rpx;
  box-sizing: border-box;
}

.hero {
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