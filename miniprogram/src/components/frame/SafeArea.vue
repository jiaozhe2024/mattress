<script setup lang="ts">
/**
 * 底部安全区（h22 + 居中手势条 120×4 圆角 4 #1e2330）
 *
 * 规格：design-tokens.md §全局结构尺寸；visual-checklist.md §全局。
 * 画板为 iPhone 手势机型示意。真实机型用 env(safe-area-inset-bottom) 时，
 * 取二者较大值，避免内容被 Home Indicator 遮挡。
 */
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** 底色（默认跟随页面白底）。 */
    background?: string;
  }>(),
  {
    background: "#ffffff",
  }
);

const rootStyle = computed(
  (): string =>
    `background:${props.background};height:max(22px, env(safe-area-inset-bottom));`
);
</script>

<template>
  <view class="safe-area" :style="rootStyle">
    <view class="safe-area-bar" />
  </view>
</template>

<style lang="scss" scoped>
.safe-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
}

.safe-area-bar {
  width: 120px;
  height: 4px;
  border-radius: $radius-4;
  background-color: $color-text-1;
}
</style>
