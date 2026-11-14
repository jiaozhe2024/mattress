<script setup lang="ts">
/**
 * 线性图标组件（内联 SVG，不引第三方图标包）
 *
 * 微信小程序不支持 <svg> 标签 → 将 utils/iconSvg.ts 生成的 SVG 以 data URI
 * 交给 <image> 渲染。可用图标见 utils/iconSvg.ts 的 ICON_PATHS。
 */
import { computed } from "vue";
import { iconBoxStyle, iconDataUri } from "@/utils/iconSvg";

const props = withDefaults(
  defineProps<{
    name: string;
    /** 设计 px（内部按 375 设计宽折算 rpx）。 */
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>(),
  {
    size: 24,
    color: "#1e2330",
    strokeWidth: 2,
  }
);

const src = computed((): string =>
  iconDataUri(props.name, {
    size: props.size,
    color: props.color,
    strokeWidth: props.strokeWidth,
  })
);

const boxStyle = computed((): string => iconBoxStyle(props.size));
</script>

<template>
  <image
    class="icon"
    :class="`icon--${name}`"
    :src="src"
    :style="boxStyle"
    mode="aspectFit"
  />
</template>

<style scoped>
.icon {
  display: block;
  flex-shrink: 0;
}
</style>
