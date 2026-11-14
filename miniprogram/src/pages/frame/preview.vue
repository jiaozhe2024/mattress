<script setup lang="ts">
/**
 * 全局复用层校验页（MP-07）
 *
 * 作用：10 个业务页未还原前，集中渲染 WechatNav（一级/二级）、SafeArea、
 * TabBar 的 three / two 两个 variant，供 scripts/e2e/frame.auto.js 做元素存在性
 * 与截图断言，以及单测之外的人工核对。
 *
 * 范围说明：本页只组合全局层组件，不含任何业务内容；不进入 tabBar，
 * 业务页面还原（MP-02 起）不受影响。
 */
import { ref } from "vue";
import SafeArea from "@/components/frame/SafeArea.vue";
import TabBar from "@/components/frame/TabBar.vue";
import WechatNav from "@/components/frame/WechatNav.vue";

const tabVariant = ref<"three" | "two">("three");

function toggleVariant(): void {
  tabVariant.value = tabVariant.value === "three" ? "two" : "three";
}
</script>

<template>
  <view class="frame-page">
    <WechatNav title="LEKASI 乐卡思" />
    <view class="frame-body">
      <view class="frame-block" data-block="nav-primary">
        <text class="frame-hint">一级页导航：左侧 LEKASI 品牌缩写</text>
      </view>
      <view class="frame-block" data-block="nav-secondary">
        <WechatNav title="产品详情" back />
        <text class="frame-hint">二级页导航：左侧 chevron-left 22×22</text>
      </view>
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
      <TabBar :variant="tabVariant" :active="tabVariant === 'three' ? 0 : -1" />
    </view>
    <view class="frame-safe" data-block="safe-area">
      <SafeArea />
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
  gap: 16px;
  padding: 16px;
}

.frame-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
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

.frame-safe {
  width: 100%;
}
</style>
