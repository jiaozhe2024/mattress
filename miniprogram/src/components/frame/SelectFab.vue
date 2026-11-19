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
import { PRODUCT_LIST_TAB, SCHEME_EDIT_PAGE, SELECTION_PAGE } from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";

const props = withDefaults(
  defineProps<{
    /** 页面滚动中：悬浮按钮降低透明度，滚动结束恢复 */
    scrolling?: boolean;
  }>(),
  { scrolling: false }
);

const store = useSelectionStore();

const badgeText = computed((): string =>
  store.selectedCount > 99 ? "99+" : String(store.selectedCount)
);

/**
 * 选款入口分流（用户 2026-11-17 决策）：
 *   - 已选 >0（store 不为空）→ 选品页，让用户继续在已有选品上增减；
 *   - 已选 =0 → 方案编辑页空态（design/references/plan-01-empty.png），
 *     由用户在那里「添加产品」再进入选品页，避免一进来就是空选品的选品页。
 *
 * 注意：不再「navigateTo 失败就 switchTab 产品列表」——那是页面未落地时的历史兜底，
 * 现在两个目标页都已存在；且产品列表是普通页而非 tab（MP-03A 起 tab 是分类页），
 * switchTab 到 /pages/product/category 会打断用户意图。
 */
function goSelection(): void {
  const target = store.selectedCount > 0 ? SELECTION_PAGE : SCHEME_EDIT_PAGE;
  uni.navigateTo({
    url: target,
    fail: () => {
      // 兜底：目标页未注册等极端情况，回产品分类 tab（选品发生地）
      uni.switchTab({ url: PRODUCT_LIST_TAB });
    },
  });
}
</script>

<template>
  <view
    class="select-fab"
    :class="{ 'select-fab--scrolling': props.scrolling }"
    @tap="goSelection"
  >
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
  width: 42px;
  height: 64px;
  /* D 字形：左上/左下圆弧，右侧直角 */
  border-radius: 32px 6px 6px 32px;
  background-color: $color-yellow;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.select-fab--scrolling {
  opacity: 0.1;
}

.select-fab-label {
  width: 1em;
  font-family: $font-family-cn;
  font-size: $font-15;
  font-weight: $font-weight-medium;
  line-height: 20px;
  text-align: center;
  word-break: break-all;
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
  padding: 0 $space-5;
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
