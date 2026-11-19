<script setup lang="ts">
/**
 * 全局复用层校验页（MP-07）
 *
 * 作用：集中校验 TabBar 的 three / two 两个 variant。
 * 导航已改用微信原生导航栏（pages.json 的 navigationBarTitleText），本页不再自绘标题栏。
 *
 * 范围说明：本页只组合全局层组件，不含任何业务内容；不进入 tabBar，
 * 业务页面还原（MP-02 起）不受影响。
 */
import { ref } from "vue";
import TabBar from "@/components/frame/TabBar.vue";

const tabVariant = ref<"three" | "two">("three");

function toggleVariant(): void {
  tabVariant.value = tabVariant.value === "three" ? "two" : "three";
}
</script>

<template>
  <view class="frame-page">
    <view class="frame-body">
      <view class="frame-block">
        <view
          class="frame-toggle"
          data-role="tab-variant-toggle"
          @tap="toggleVariant"
        >
          <text class="frame-toggle-text">切换 TabBar variant（当前 {{ tabVariant }}）</text>
        </view>
      </view>
    </view>
    <view class="frame-tabbar" data-block="tabbar">
      <TabBar
        :variant="tabVariant"
        :active="tabVariant === 'three' ? 0 : -1"
        class="tabbar-anchor"
        :data-tabbar-variant="tabVariant"
        :data-tabbar-count="3"
        :data-tabbar-active="tabVariant === 'three' ? '0' : '-1'"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.frame-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: $color-cream;
}

.frame-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space-16;
  padding: $space-16;
}

.frame-block {
  display: flex;
  flex-direction: column;
  gap: $space-8;
  padding: $space-12;
  border-radius: 8px;
  background-color: $color-text-inv;
}

.frame-hint {
  font-size: 12px;
  color: $color-text-3;
}

.frame-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  border-radius: 20px;
  background-color: $color-yellow;
}

.frame-toggle-text {
  font-size: 15px;
  font-weight: 500;
  color: $color-navy;
}

.frame-tabbar {
  width: 100%;
}
</style>
