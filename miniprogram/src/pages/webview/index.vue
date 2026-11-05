<script setup lang="ts">
/** 外链承载页（aaa.md §3.2.2 jump_type=4）。仅接受 http(s) 地址。 */
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";

const url = ref("");
const invalid = ref(false);

onLoad((options) => {
  const decoded = decodeURIComponent(options?.url ?? "");
  if (!/^https?:\/\/.+/i.test(decoded)) {
    invalid.value = true;
    return;
  }
  url.value = decoded;
});
</script>

<template>
  <web-view v-if="url" :src="url" />
  <view v-else class="state-box">
    <text class="state-text">{{ invalid ? "链接地址不合法" : "缺少链接参数" }}</text>
  </view>
</template>

<style scoped>
.state-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120rpx 32rpx;
}

.state-text {
  font-size: 26rpx;
  color: #8a90a3;
}
</style>
