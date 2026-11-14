<script setup lang="ts">
/**
 * 选款悬浮胶囊（V3，首页 / 产品分类列表复用）
 *
 * 规格：spec.md §5.1 ⑤ + visual-checklist.md §首页
 *   - 64×42、圆角 20、bg yellow、距右 12 距底 90（设计稿按画板绝对定位）
 *   - 文字 `选款` Medium 15 navy，行高 22
 *   - 已选数量 >0 时在胶囊右上显示角标（99+ 封顶）
 *
 * 说明：实现用 fixed 而非 absolute —— 视觉位置与稿一致（距右 12 / 距底 90），
 * 但滚动时保持常驻（与 MP-01 既有骨架 e2e「悬浮按钮」语义一致）。
 */
import { computed } from "vue";
import { PRODUCT_LIST_TAB, SELECTION_PAGE } from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";

const store = useSelectionStore();

const badgeText = computed((): string =>
  store.selectedCount > 99 ? "99+" : String(store.selectedCount)
);

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
    <text class="select-fab-label">选款</text>
    <view v-if="store.selectedCount > 0" class="select-fab-badge">
      <text class="select-fab-badge-text">{{ badgeText }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.select-fab {
  position: fixed;
  right: $space-12;
  bottom: 90px;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 42px;
  border-radius: $radius-20;
  background-color: $color-yellow;
}

.select-fab-label {
  font-family: $font-family-cn;
  font-size: $font-15;
  font-weight: $font-weight-medium;
  line-height: $line-height-15-fixed;
  color: $color-navy;
}

.select-fab-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: $radius-pill;
  background-color: $color-navy;
}

.select-fab-badge-text {
  font-family: $font-family-en;
  font-size: $font-10;
  font-weight: $font-weight-semibold;
  line-height: 1;
  color: $color-text-inv;
}
</style>
