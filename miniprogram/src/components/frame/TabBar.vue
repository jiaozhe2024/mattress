<script setup lang="ts">
/**
 * 底部导航（Q1 决议：两套结构做成同一组件的 variant；优化阶段只改配置不改结构）
 *
 * 规格：design-tokens.md §全局结构尺寸 + visual-checklist.md §底部 Tab
 *   - h58、左右 padding 28、上边框 1px #e9ecf2
 *   - 单项宽 64、纵向 gap3、图标 24×24、文字 10px
 *   - 选中：文字 #1a2260 不透明；未选中：文字 #4a5165 + 整体 opacity 60%
 *
 * variant：
 *   three = 首页 / 产品 / 我的    （微信原生 tabBar 页；custom-tab-bar 走同一套视觉）
 *   two   = 首页 / 返回（undo-2）（非 tabBar 的二级页，由页面自行挂载）
 */
import { computed } from "vue";
import Icon from "@/components/icons/Icon.vue";
import {
  tabBarActiveIndexOf,
  tabBarItemsOf,
  type TabBarItem,
  type TabBarVariant,
} from "@/components/frame/tabBarModel";

const props = withDefaults(
  defineProps<{
    variant?: TabBarVariant;
    /** 选中项下标；缺省时 three=0（首页），two=-1（无选中）。 */
    active?: number;
  }>(),
  {
    variant: "three",
    active: undefined,
  }
);

const emit = defineEmits<{
  (event: "change", index: number, item: TabBarItem): void;
}>();

const items = computed((): readonly TabBarItem[] => tabBarItemsOf(props.variant));
const activeIndex = computed((): number =>
  tabBarActiveIndexOf(props.variant, props.active)
);

function onTap(item: TabBarItem, index: number): void {
  if (item.key === "back") {
    uni.navigateBack({
      fail: () => {
        uni.reLaunch({ url: "/pages/index/index" });
      },
    });
    emit("change", index, item);
    return;
  }
  if (props.variant === "three" && index === activeIndex.value) {
    return;
  }
  if (item.path) {
    uni.switchTab({
      url: item.path,
      fail: () => {
        uni.reLaunch({ url: item.path as string });
      },
    });
  }
  emit("change", index, item);
}
</script>

<template>
  <view class="tabbar" :class="`tabbar--${variant}`" :data-variant="variant">
    <view
      v-for="(item, index) in items"
      :key="item.key"
      class="tabbar-item"
      :class="{ 'tabbar-item--active': index === activeIndex }"
      :data-key="item.key"
      @tap="onTap(item, index)"
    >
      <Icon
        :name="item.icon"
        :size="24"
        :color="index === activeIndex ? '#1a2260' : '#4a5165'"
      />
      <text class="tabbar-label">{{ item.label }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.tabbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 58px;
  padding: 0 28px;
  box-sizing: border-box;
  background-color: $color-text-inv;
  border-top: 1px solid $color-line;
}

.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 64px;
  opacity: 0.6;
}

.tabbar-item--active {
  opacity: 1;
}

.tabbar-label {
  font-family: $font-family-cn;
  font-size: 10px;
  line-height: normal;
  color: $color-text-2;
}

.tabbar-item--active .tabbar-label {
  color: $color-navy;
}
</style>
