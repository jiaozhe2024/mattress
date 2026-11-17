<script setup lang="ts">
/**
 * 方案编辑页（MP-05B，V3 二级页 §5.5 空态 / §5.7 填充态 —— 同一页两种状态）
 *
 * 真值来源：docs/design/references/plan-01-empty.png + plan-03-edit.png +
 * design-spec/spec.md §5.5 / §5.7 + open-questions.md Q3 / Q8 / Q12 / Q13。
 *
 * 结构：微信导航（二级页）→ 方案标题输入 → 已选产品（空态 / 填充态）→
 *       详情展开提示 → 底部操作条（Q3：一份可配 variant 配置驱动）→ 安全区。
 * 选品状态全程走 useSelectionStore（核心约定 9，禁止 storage/全局变量）。
 */
import { onLoad } from "@dcloudio/uni-app";
import { computed, nextTick, ref } from "vue";
import {
  ADD_PRODUCT_LABEL,
  DETAIL_TOGGLE_LABEL,
  EDIT_NAV_TITLE,
  REMARK_MAX_LENGTH,
  SCHEME_ACTION_BUTTONS,
  SCHEME_LIST_PENDING_TOAST,
  SCHEME_PREVIEW_PENDING_TOAST,
  SAVE_FAILED_MESSAGE,
  TITLE_MAX_LENGTH,
  TITLE_PLACEHOLDER,
  buildSchemePayload,
  productCountText,
  productIdsOf,
  validateSchemeTitle,
  type SchemeActionButtonConfig,
} from "@/components/scheme/schemeEditModel";
import { createScheme, getSchemeDetail, updateScheme } from "@/api/scheme";
import SafeArea from "@/components/frame/SafeArea.vue";
import WechatNav from "@/components/frame/WechatNav.vue";
import Icon from "@/components/icons/Icon.vue";
import {
  SCHEME_LIST_PAGE,
  SCHEME_PREVIEW_PAGE,
  SELECTION_PAGE,
} from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";
import type { Product } from "@/types/product";
import { absoluteUrl } from "@/utils/url";

/** 图标/占位色镜像 token（Icon 的 color 进 SVG data URI，无法取 CSS 变量）。 */
const ICON_COLOR = "#8a90a3";
const TITLE_PLACEHOLDER_STYLE =
  "color:#8a90a3;font-size:14px;line-height:1.45";
const REMARK_PLACEHOLDER_STYLE =
  "color:#8a90a3;font-size:13px;line-height:1.5";

const selectionStore = useSelectionStore();

const title = ref("");
const remark = ref("");
const detailOpen = ref(false);
const titleFocus = ref(false);
const saving = ref(false);

const selectedProducts = computed((): readonly Product[] =>
  selectionStore.selectedProducts
);
const hasProducts = computed((): boolean => selectedProducts.value.length > 0);
const countText = computed((): string =>
  productCountText(selectedProducts.value.length)
);

/** Q3：本轮照稿等权重，视图仅按 tone 分发样式类。 */
const buttons = SCHEME_ACTION_BUTTONS;

function onTitleInput(event: Event): void {
  const value = (event as CustomEvent<{ value: string }>).detail?.value ?? "";
  title.value = value;
}

function onRemarkInput(event: Event): void {
  const value = (event as CustomEvent<{ value: string }>).detail?.value ?? "";
  remark.value = value;
}

function focusTitle(): void {
  titleFocus.value = false;
  void nextTick(() => {
    titleFocus.value = true;
  });
}

function onTitleBlur(): void {
  titleFocus.value = false;
}

function onAddProduct(): void {
  uni.navigateTo({
    url: SELECTION_PAGE,
    fail: () => {
      uni.showToast({ title: "选品页建设中", icon: "none" });
    },
  });
}

function onRemoveProduct(productId: number): void {
  selectionStore.removeProduct(productId);
}

function toggleDetail(): void {
  detailOpen.value = !detailOpen.value;
}

/**
 * 从方案详情快照还原选品 store 的 Product（核心约定 10：展示一律读快照）。
 *
 * 只映射 Product 契约内的字段；快照里的 detail_images/real_images/detail_content
 * 等富展示字段不进选品 store（本页只用到主图与名称）。缺省字段给安全默认值，
 * 避免脏数据导致渲染崩。
 */
function productFromSnapshot(snapshot: Record<string, unknown>): Product {
  const text = (key: string): string =>
    typeof snapshot[key] === "string" ? (snapshot[key] as string) : "";

  return {
    id: typeof snapshot.id === "number" ? snapshot.id : 0,
    name: text("name"),
    model: text("model"),
    main_image: text("main_image"),
    spec: text("spec"),
    sleep_feel: text("sleep_feel"),
    slogan: text("slogan"),
  };
}

/**
 * 从方案列表点进来时按 ?id= 载入已有方案（MP-05C 的入口）。
 *
 * 不能只依赖 Pinia 里的选品：从列表进入时 Pinia 可能是空的，必须按 id 拉详情，
 * 用快照还原选品 + 标题 + 备注，并把 currentSchemeId 设为该方案（保存时走 PUT）。
 */
onLoad((options) => {
  const rawId = options?.id;
  const id = rawId === undefined ? Number.NaN : Number(rawId);
  if (!Number.isFinite(id) || id <= 0) return;

  void (async (): Promise<void> => {
    try {
      const detail = await getSchemeDetail(id);
      title.value = detail.title;
      remark.value = detail.remark ?? "";
      selectionStore.$patch({
        selectedProducts: detail.products.map((row) =>
          productFromSnapshot(row.snapshot)
        ),
        currentSchemeId: detail.id,
      });
    } catch {
      uni.showToast({ title: "方案加载失败", icon: "none" });
    }
  })();
});

/**
 * 保存（POST 新建 / PUT 更新）。
 * 成功返回方案 id；失败返回 null（错误已 toast，调用方不再跳转）。
 */
async function saveScheme(): Promise<number | null> {
  if (saving.value) return null;
  const titleError = validateSchemeTitle(title.value);
  if (titleError !== null) {
    uni.showToast({ title: titleError, icon: "none" });
    return null;
  }

  const payload = buildSchemePayload(
    title.value,
    productIdsOf(selectedProducts.value),
    remark.value
  );
  saving.value = true;
  try {
    const schemeId = selectionStore.currentSchemeId;
    const saved =
      schemeId !== null
        ? await updateScheme(schemeId, payload)
        : await createScheme(payload);
    // Pinia 是方案状态的唯一持有者（核心约定 9）：保存成功后记住当前方案 id
    selectionStore.$patch({ currentSchemeId: saved.id });
    return saved.id;
  } catch (error) {
    const message =
      error instanceof Error && error.message !== ""
        ? error.message
        : SAVE_FAILED_MESSAGE;
    uni.showToast({ title: message, icon: "none" });
    return null;
  } finally {
    saving.value = false;
  }
}

async function onSave(): Promise<void> {
  const schemeId = await saveScheme();
  if (schemeId === null) return;
  uni.showToast({ title: "保存成功", icon: "none" });
  navigateToSchemeList();
}

async function onPreview(): Promise<void> {
  const schemeId = await saveScheme();
  if (schemeId === null) return;
  uni.navigateTo({
    url: `${SCHEME_PREVIEW_PAGE}?id=${schemeId}`,
    fail: () => {
      uni.showToast({ title: SCHEME_PREVIEW_PENDING_TOAST, icon: "none" });
    },
  });
}

/**
 * 「我的方案」→ 方案列表页。
 *
 * 用 redirectTo 替换当前编辑页：编辑页 → 列表 → 点方案又进编辑页，
 * 用 navigateTo 会不断叠层（列表返回时落在上一个编辑页而不是首页）。
 * redirectTo 让列表的返回直接回到进入编辑页之前的页面（首页/分类页）。
 */
function navigateToSchemeList(): void {
  uni.redirectTo({
    url: SCHEME_LIST_PAGE,
    fail: () => {
      uni.showToast({ title: SCHEME_LIST_PENDING_TOAST, icon: "none" });
    },
  });
}

function onAction(button: SchemeActionButtonConfig): void {
  if (button.key === "mine") {
    navigateToSchemeList();
    return;
  }
  if (button.key === "save") {
    void onSave();
    return;
  }
  void onPreview();
}
</script>

<template>
  <view class="se-page">
    <WechatNav :title="EDIT_NAV_TITLE" back class="nav-anchor" :data-nav-title="EDIT_NAV_TITLE" :data-nav-back="1" />

    <scroll-view class="se-scroll" scroll-y :show-scrollbar="false">
      <view class="se-body">
        <!-- ① 方案标题输入：h48，下边框 1px line，右侧 pencil 16×16 -->
        <view class="se-title-row">
          <input
            class="se-title-input"
            type="text"
            :value="title"
            :focus="titleFocus"
            :maxlength="TITLE_MAX_LENGTH"
            :placeholder="TITLE_PLACEHOLDER"
            :placeholder-style="TITLE_PLACEHOLDER_STYLE"
            @input="onTitleInput"
            @blur="onTitleBlur"
          />
          <view class="se-title-pencil" @tap="focusTitle">
            <Icon name="pencil" :size="16" :color="ICON_COLOR" />
          </view>
        </view>

        <!-- ② 已选产品：空态 112×126 / 填充态缩略图 105×126 + 添加卡 105×126 -->
        <scroll-view
          class="se-products"
          scroll-x
          :show-scrollbar="false"
        >
          <view class="se-products-track">
            <view
              v-for="product in selectedProducts"
              :key="product.id"
              class="se-thumb"
            >
              <image
                v-if="product.main_image"
                class="se-thumb-image"
                :src="absoluteUrl(product.main_image)"
                mode="aspectFill"
              />
              <text class="se-thumb-name">{{ product.name }}</text>
              <!-- Q13：视觉 20×20，透明热区 44×44 -->
              <view
                class="se-thumb-remove-hit"
                @tap.stop="onRemoveProduct(product.id)"
              >
                <view class="se-thumb-remove">
                  <text class="se-thumb-remove-icon">×</text>
                </view>
              </view>
            </view>

            <view
              class="se-add-card"
              :class="{ 'se-add-card--wide': !hasProducts }"
              @tap="onAddProduct"
            >
              <Icon name="plus" :size="26" :color="ICON_COLOR" />
              <text class="se-add-text">{{ ADD_PRODUCT_LABEL }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- ③ 详情展开提示（pt14 gap5 居中） -->
        <view class="se-detail">
          <text class="se-count">{{ countText }}</text>
          <view class="se-divider" />
          <view class="se-detail-toggle" @tap="toggleDetail">
            <text class="se-detail-label">{{ DETAIL_TOGGLE_LABEL }}</text>
            <view
              class="se-detail-chevron"
              :class="{ 'se-detail-chevron--open': detailOpen }"
            >
              <Icon name="chevron-down" :size="24" :color="ICON_COLOR" />
            </view>
          </view>
          <!-- Q8：展开态画板未设计，给最小可用 textarea -->
          <textarea
            v-if="detailOpen"
            class="se-remark"
            :value="remark"
            :maxlength="REMARK_MAX_LENGTH"
            placeholder="补充方案说明（选填）"
            :placeholder-style="REMARK_PLACEHOLDER_STYLE"
            @input="onRemarkInput"
          />
        </view>
      </view>
    </scroll-view>

    <!-- ④ 底部操作条（Q3：一份配置驱动三个按钮，本轮等权重） -->
    <view class="se-actions">
      <view
        v-for="button in buttons"
        :key="button.key"
        class="se-action"
        :class="`se-action--${button.tone}`"
        :style="`width:${button.width}px;`"
        @tap="onAction(button)"
      >
        <text class="se-action-text">{{ button.label }}</text>
      </view>
    </view>
    <SafeArea />
  </view>
</template>

<style lang="scss" scoped>
.se-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: $color-text-inv;
}

.se-scroll {
  flex: 1;
  min-height: 0;
}

/* ① 方案编辑内容：p20 gap20 */
.se-body {
  display: flex;
  flex-direction: column;
  gap: $space-20;
  padding: $space-20;
  box-sizing: border-box;
}

/* 方案标题输入：h48 + 下边框 1px line */
.se-title-row {
  display: flex;
  align-items: center;
  gap: $space-8;
  height: 48px;
  border-bottom: 1px solid $color-line;
  box-sizing: border-box;
}

.se-title-input {
  flex: 1;
  min-width: 0;
  height: 48px;
  font-family: $font-family-cn;
  font-size: $font-14;
  font-weight: $font-weight-regular;
  line-height: $line-height-14;
  color: $color-text-1;
}

/* Q13：pencil 视觉 16×16，透明热区 44×44 */
.se-title-pencil {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  width: 44px;
  height: 44px;
}

/* ② 已选产品：缩略图与添加卡同一行，横向可滚动 */
.se-products {
  width: 100%;
  white-space: nowrap;
}

.se-products-track {
  display: inline-flex;
  gap: $space-9;
}

/* 填充态缩略图 105×126 bg cream 圆角 8 */
.se-thumb {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 105px;
  height: 126px;
  overflow: hidden;
  border-radius: $radius-8;
  background-color: $color-cream;
}

.se-thumb-image {
  width: 105px;
  height: 90px;
}

/* 产品名 Regular 10 navy 居中 */
.se-thumb-name {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 $space-4;
  box-sizing: border-box;
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-navy;
  text-align: center;
  white-space: normal;
}

/* Q13：移除角标透明热区 44×44（视觉 20×20 贴右上角） */
.se-thumb-remove-hit {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  width: 44px;
  height: 44px;
}

/* 移除按钮 20×20 bg navy，×  Inter Regular 15 textInv */
.se-thumb-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background-color: $color-navy;
}

.se-thumb-remove-icon {
  font-family: $font-family-en;
  font-size: $font-15;
  font-weight: $font-weight-regular;
  line-height: $line-height-15;
  color: $color-text-inv;
}

/* 添加产品卡：填充态 105×126，空态 112×126；bg fill 圆角 8 gap8 居中 */
.se-add-card {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: $space-8;
  width: 105px;
  height: 126px;
  border-radius: $radius-8;
  background-color: $color-fill;
}

.se-add-card--wide {
  width: 112px;
}

.se-add-text {
  font-family: $font-family-cn;
  font-size: $font-11;
  font-weight: $font-weight-regular;
  line-height: $line-height-11;
  color: $color-text-3;
}

/* ③ 详情展开提示：pt14 gap5 居中 */
.se-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-5;
  padding-top: $space-12 + $space-2;
}

.se-count {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-3;
  text-align: center;
}

.se-divider {
  width: 100%;
  height: 1px;
  background-color: $color-line;
}

.se-detail-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-5;
}

.se-detail-label {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-3;
}

.se-detail-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  transition: transform 0.2s;
}

.se-detail-chevron--open {
  transform: rotate(180deg);
}

/* Q8：展开态最小可用样式 */
.se-remark {
  width: 100%;
  min-height: 88px;
  padding: $space-12;
  box-sizing: border-box;
  border-radius: $radius-8;
  background-color: $color-fill;
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13;
  color: $color-text-1;
}

/* ④ 底部操作条：bg navy p14 gap8 */
.se-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: $space-8;
  padding: $space-8 + $space-6;
  box-sizing: border-box;
  background-color: $color-navy;
}

/* Q3：三个按钮同结构，仅按 tone 分发样式 */
.se-action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  border-radius: $radius-20;
  box-sizing: border-box;
}

.se-action--secondary {
  border: 1px solid $color-navy-50;
  background-color: $color-text-inv;
}

.se-action--primary {
  background-color: $color-yellow;
}

.se-action-text {
  font-family: $font-family-cn;
  font-weight: $font-weight-medium;
}

.se-action--secondary .se-action-text {
  font-size: $font-14;
  line-height: $line-height-14-fixed;
  color: $color-text-2;
}

.se-action--primary .se-action-text {
  font-size: $font-15;
  line-height: $line-height-15-fixed;
  color: $color-navy;
}
</style>
