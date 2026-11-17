<script setup lang="ts">
/**
 * 我的（MP-06，V3 一级页 §5.10）
 *
 * 真值来源：docs/design/references/mine.png + design-spec/spec.md §5.10 +
 * open-questions.md Q2（照稿不加「我的方案」入口）/ Q7（品牌介绍页无画板，点击 toast）/
 * Q12（不实现版本标识条）。
 *
 * 结构：微信导航（一级页，左侧 LEKASI 缩写）→ 关于乐卡思（bg navy）→ 客服服务（bg navyDeep）。
 * 底部 TabBar 由原生 custom-tab-bar 渲染（我的选中）；本页**无**选款 FAB（spec §5.10 ②）。
 *
 * 数据：GET /wxapi/brand（单行，缺失时 data=null）。品牌文案/空间图/加盟电话全部走
 * mineModel 的兜底函数，因此页面没有加载态与错误态 —— 后台无配置时直接渲染稿内文案，
 * 不把运维侧的缺失暴露成空白页。
 */
import { computed, ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { getBrand } from "@/api/content";
import Icon from "@/components/icons/Icon.vue";
import WechatNav from "@/components/frame/WechatNav.vue";
import {
  MINE_BRAND,
  MINE_CONTACT_LINE,
  MINE_LEARN_LABEL,
  MINE_LEARN_PENDING_TOAST,
  MINE_NAV_TITLE,
  MINE_SERVICE_FAIL_TOAST,
  MINE_SERVICE_ICON_COLOR,
  MINE_SERVICE_ITEMS,
  MINE_SERVICE_TITLE,
  MINE_SLOGAN,
  MINE_SPACE_CAPTION,
  hasCustomerServiceConfig,
  introLinesOf,
  spaceImageOf,
  type ServiceItem,
} from "@/components/user/mineModel";
import { CUSTOMER_SERVICE } from "@/config";
import type { WxBrandInfo } from "@/types/home";
import { absoluteUrl } from "@/utils/url";

const brand = ref<WxBrandInfo | null>(null);
/** 空间图加载失败一次后降级为占位层，避免破图。 */
const spaceImageFailed = ref(false);

const introLines = computed(() => introLinesOf(brand.value));
const spaceImageSrc = computed((): string => {
  const value = spaceImageOf(brand.value);
  return value === "" ? "" : absoluteUrl(value);
});
const showSpaceImage = computed(
  (): boolean => spaceImageSrc.value !== "" && !spaceImageFailed.value
);

onLoad(() => {
  void loadBrand();
});

/**
 * 拉品牌配置。失败时静默（brand 保持 null → 全套稿内文案兜底），
 * 不弹 toast：一级 tab 页反复进入，报错噪音会盖过页面本身。
 */
async function loadBrand(): Promise<void> {
  try {
    brand.value = await getBrand();
  } catch {
    brand.value = null;
  }
}

/** Q7 DEFERRED：品牌介绍页无画板，按约定给 toast。 */
function onLearnTap(): void {
  uni.showToast({ title: MINE_LEARN_PENDING_TOAST, icon: "none" });
}

interface OpenCustomerServiceChatOptions {
  corpId: string;
  extInfo: { url: string };
  fail?: () => void;
}

/**
 * 客服项点击 → 企业微信客服会话。
 *
 * 配置仍是 placeholder 时（config.ts 注释：待运营开通后回填）直接 toast，
 * 不调用必然失败的开放能力 —— 否则微信会弹自己的错误提示，观感更差。
 */
function onServiceTap(_item: ServiceItem): void {
  if (!hasCustomerServiceConfig(CUSTOMER_SERVICE)) {
    uni.showToast({ title: MINE_SERVICE_FAIL_TOAST, icon: "none" });
    return;
  }
  const api = uni.openCustomerServiceChat as
    | ((options: OpenCustomerServiceChatOptions) => void)
    | undefined;
  if (typeof api !== "function") {
    uni.showToast({ title: MINE_SERVICE_FAIL_TOAST, icon: "none" });
    return;
  }
  api({
    corpId: CUSTOMER_SERVICE.corpId,
    extInfo: { url: CUSTOMER_SERVICE.kfUrl },
    fail: () => {
      uni.showToast({ title: MINE_SERVICE_FAIL_TOAST, icon: "none" });
    },
  });
}
</script>

<template>
  <view class="mine">
    <WechatNav :title="MINE_NAV_TITLE" class="nav-anchor" :data-nav-title="MINE_NAV_TITLE" />

    <!-- ① 品牌介绍：p4 gap4（稿内两块卡片四周留 4px 白边） -->
    <view class="mine-body">
      <!-- 关于乐卡思：bg navy px20 pt26 pb20 gap24 -->
      <view class="mine-brand-card">
        <text class="mine-brand">{{ MINE_BRAND }}</text>

        <!-- 品牌理念：py20 gap14 居中 -->
        <view class="mine-intro">
          <text class="mine-slogan">{{ MINE_SLOGAN }}</text>
          <view class="mine-underline" />
          <view class="mine-intro-lines">
            <text
              v-for="(line, index) in introLines"
              :key="index"
              class="mine-intro-line"
            >
              {{ line }}
            </text>
          </view>
        </view>

        <!-- 家居展示空间图 h315 圆角 8 -->
        <image
          v-if="showSpaceImage"
          class="mine-space"
          :src="spaceImageSrc"
          mode="aspectFill"
          @error="spaceImageFailed = true"
        />
        <view v-else class="mine-space mine-space--fallback" />
        <text class="mine-space-caption">{{ MINE_SPACE_CAPTION }}</text>

        <!-- 品牌联系入口：gap10 居中 -->
        <view class="mine-contact">
          <view class="mine-learn" @tap="onLearnTap">
            <text class="mine-learn-text">{{ MINE_LEARN_LABEL }}</text>
          </view>
          <text class="mine-contact-line">{{ MINE_CONTACT_LINE }}</text>
        </view>
      </view>

      <!-- 客服服务：bg navyDeep px20 py24 gap20 -->
      <view class="mine-service-card">
        <!-- 客服标题：gap10 居中 -->
        <view class="mine-service-head">
          <Icon name="message-circle" :size="30" :color="MINE_SERVICE_ICON_COLOR" />
          <text class="mine-service-title">{{ MINE_SERVICE_TITLE }}</text>
        </view>

        <!-- 客服内容：gap8 三列等分，纵向 gap5 -->
        <view class="mine-service-list">
          <view
            v-for="item in MINE_SERVICE_ITEMS"
            :key="item.key"
            class="mine-service-item"
            @tap="onServiceTap(item)"
          >
            <text class="mine-service-name">{{ item.title }}</text>
            <text class="mine-service-caption">{{ item.caption }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.mine {
  min-height: 100vh;
  box-sizing: border-box;
  background-color: $color-text-inv;
}

/* ① 品牌介绍：p4 gap4；底部留出原生 TabBar 高度，避免客服块被遮挡 */
.mine-body {
  display: flex;
  flex-direction: column;
  gap: $space-4;
  padding: $space-4 $space-4 $tabbar-height;
  box-sizing: border-box;
}

/* ---------------- 关于乐卡思 ---------------- */
.mine-brand-card {
  display: flex;
  flex-direction: column;
  gap: $space-24;
  padding: $space-26 $space-20 $space-20;
  box-sizing: border-box;
  background-color: $color-navy;
}

/* 品牌行：Inter Bold 15 yellow 字距 2 */
.mine-brand {
  font-family: $font-family-en;
  font-size: $font-15;
  font-weight: $font-weight-bold;
  line-height: $line-height-15;
  letter-spacing: 2px;
  color: $color-yellow;
}

/* 品牌理念：py20 gap14 居中 */
.mine-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-14;
  padding: $space-20 0;
  box-sizing: border-box;
}

/* 主标语：Medium 31 textInv */
.mine-slogan {
  font-family: $font-family-cn;
  font-size: $font-31;
  font-weight: $font-weight-medium;
  line-height: $line-height-31;
  color: $color-text-inv;
  text-align: center;
}

/* 标题强调条 72×3 bg yellow */
.mine-underline {
  width: 72px;
  height: 3px;
  border-radius: $radius-2;
  background-color: $color-yellow;
}

.mine-intro-lines {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 三行段落：Regular 12 textInv 行高 1.45 */
.mine-intro-line {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-inv;
  text-align: center;
}

/* 空间图 h315 圆角 8 */
.mine-space {
  display: block;
  width: 100%;
  height: 315px;
  border-radius: $radius-8;
  background-color: $color-navy-soft;
}

.mine-space--fallback {
  background-color: $color-navy-soft;
}

/* 图注：Regular 10 navy50 居中 行高 1.45 */
.mine-space-caption {
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-navy-50;
  text-align: center;
}

/* 品牌联系入口：gap10 居中 */
.mine-contact {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-10;
}

/* 了解乐卡思：220×42 圆角 20 bg yellow */
.mine-learn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 220px;
  height: 42px;
  border-radius: $radius-20;
  background-color: $color-yellow;
}

/* 按钮文字：Medium 15 navy 行高 22 */
.mine-learn-text {
  font-family: $font-family-cn;
  font-size: $font-15;
  font-weight: $font-weight-medium;
  line-height: $line-height-15-fixed;
  color: $color-navy;
}

/* 联系行：Regular 12 textInv 居中 */
.mine-contact-line {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-inv;
  text-align: center;
}

/* ---------------- 客服服务 ---------------- */
.mine-service-card {
  display: flex;
  flex-direction: column;
  gap: $space-20;
  padding: $space-24 $space-20;
  box-sizing: border-box;
  background-color: $color-navy-deep;
}

/* 客服标题：gap10 居中 */
.mine-service-head {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $space-10;
}

/* 乐卡思客服：Regular 27 textInv */
.mine-service-title {
  font-family: $font-family-cn;
  font-size: $font-27;
  font-weight: $font-weight-regular;
  line-height: $line-height-27;
  color: $color-text-inv;
}

/* 客服内容：gap8 三列等分 */
.mine-service-list {
  display: flex;
  flex-direction: row;
  gap: $space-8;
}

/* 单项：三列等分、居中、纵向 gap5 */
.mine-service-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: $space-5;
}

/* 项目：Regular 12 textInv */
.mine-service-name {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-inv;
  text-align: center;
}

/* 说明：Regular 10 navy50 */
.mine-service-caption {
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-navy-50;
  text-align: center;
}
</style>
