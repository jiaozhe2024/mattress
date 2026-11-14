<script setup lang="ts">
/**
 * 微信标题导航（h44 自绘；状态栏与微信胶囊由系统渲染）
 *
 * 规格：docs/design/design-spec/design-tokens.md §全局结构尺寸
 *   - 标题导航 h44，左右 padding 16
 *   - 一级页左侧 LEKASI（Inter Bold 12 navy 字距 2）；二级页 chevron-left 22×22
 *   - 中间标题 Noto Sans SC Bold 15 text1 垂直居中
 *   - 右侧按胶囊实际位置留白（uni.getMenuButtonBoundingClientRect，异常兜底 76）
 *
 * 用法：
 *   <WechatNav title="乐卡思 LEKASI" />                // 一级页
 *   <WechatNav title="产品详情" back />                // 二级页
 *   fixed 时组件自身占位（spacer）+ 固定定位，页面正文无需再写 padding-top。
 */
import { computed } from "vue";
import Icon from "@/components/icons/Icon.vue";
import { readNavLayout } from "@/utils/navLayout";

const props = withDefaults(
  defineProps<{
    /** 中间标题。 */
    title?: string;
    /** 二级页：左侧显示返回箭头并返回上一页。 */
    back?: boolean;
    /** 固定到页面顶部。 */
    fixed?: boolean;
    /** 导航底色。 */
    background?: string;
  }>(),
  {
    title: "",
    back: false,
    fixed: false,
    background: "#ffffff",
  }
);

const layout = readNavLayout();

const wrapperStyle = computed(
  (): string =>
    `padding-top:${layout.statusBarHeight}px;background:${props.background};`
);
const barStyle = computed((): string => `height:${layout.navBarHeight}px;`);
const spacerStyle = computed(
  (): string => `height:${layout.totalHeight}px;`
);
const rightSafeStyle = computed(
  (): string => `width:${layout.rightSafeWidth}px;`
);
const leftSlotStyle = computed(
  (): string => `width:${layout.rightSafeWidth}px;`
);

function goBack(): void {
  uni.navigateBack({
    fail: () => {
      // 直接进入的页面（无上一页）回首页，避免返回按钮无效
      uni.switchTab({
        url: "/pages/index/index",
        fail: () => {
          uni.reLaunch({ url: "/pages/index/index" });
        },
      });
    },
  });
}
</script>

<template>
  <view class="wnav" :data-nav-fallback="layout.fallback ? '1' : '0'">
    <view
      v-if="fixed"
      class="wnav-spacer"
      :style="spacerStyle"
    />
    <view
      class="wnav-root"
      :class="{ 'wnav-root--fixed': fixed }"
      :style="wrapperStyle"
    >
      <view class="wnav-bar" :style="barStyle">
        <view class="wnav-left" :style="leftSlotStyle">
          <view v-if="back" class="wnav-back" @tap="goBack">
            <Icon name="chevron-left" :size="22" color="#1e2330" />
          </view>
          <text v-else class="wnav-brand">LEKASI</text>
        </view>
        <view class="wnav-center">
          <text class="wnav-title">{{ title }}</text>
        </view>
        <view class="wnav-right" :style="rightSafeStyle" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.wnav-root {
  width: 100%;
  box-sizing: border-box;
}

.wnav-root--fixed {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 900;
}

.wnav-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  box-sizing: border-box;
}

.wnav-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.wnav-back {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  /* Q13 热区先行：视觉 22×22，透明热区 ≥44×44 */
  width: 44px;
  height: 44px;
  margin-left: -11px;
}

.wnav-brand {
  font-family: $font-family-en;
  font-size: 12px;
  font-weight: $font-weight-bold;
  letter-spacing: 2px;
  color: $color-navy;
  line-height: 1;
}

.wnav-center {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  display: flex;
  align-items: center;
  max-width: 60%;
  transform: translateX(-50%);
}

.wnav-title {
  font-family: $font-family-cn;
  font-size: 15px;
  font-weight: $font-weight-bold;
  color: $color-text-1;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wnav-right {
  flex-shrink: 0;
}
</style>
