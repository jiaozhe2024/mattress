<script setup lang="ts">
/**
 * 选品页（MP-05A，V3 二级页 §5.6）
 *
 * 真值来源：docs/design/references/plan-02-picker.png + design-spec/spec.md §5.6 +
 * open-questions.md Q10（右栏自适应，禁止硬编码 126.92px）/ Q11（字号取整 10/8/8）/
 * Q12（不实现版本条）/ Q13（+ / ✓ / × 透明热区 ≥44×44）。
 *
 * 结构：微信导航（二级页）→ 搜索 → 左右双栏（分类导航 + 产品网格）→ 已选栏。
 * 选品状态全程走 useSelectionStore（核心约定 9，禁止 storage/全局变量传参）。
 *
 * 数据层复用：api/product.ts（getProducts/getCategories/toSelectionProduct）、
 * composables/useProductList.ts（分页 + 竞态防护）、utils/debounce.ts（300ms）。
 */
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import {
  getCategories,
  toSelectionProduct,
} from "@/api/product";
import {
  DETAIL_LABEL,
  OK_LABEL,
  SCHEME_EDIT_PENDING_TOAST,
  SELECTION_NAV_TITLE,
  SELECTION_SEARCH_PLACEHOLDER,
  isProductSelected,
  selectedCountText,
  specTextOf,
  thumbnailsOf,
} from "@/components/scheme/schemeSelectionModel";
import { sleepFeelTagOf } from "@/components/product/productListModel";
import SafeArea from "@/components/frame/SafeArea.vue";
import WechatNav from "@/components/frame/WechatNav.vue";
import Icon from "@/components/icons/Icon.vue";
import { useProductList } from "@/composables/useProductList";
import { SCHEME_EDIT_PAGE } from "@/config";
import { useSelectionStore } from "@/stores/useSelectionStore";
import type { WxCategory } from "@/types/home";
import type { WxProductListItem } from "@/types/product";
import { debounce } from "@/utils/debounce";
import { absoluteUrl } from "@/utils/url";

const SEARCH_DEBOUNCE_MS = 300;

/** 图标/占位色镜像 token（Icon 的 color 进 SVG data URI，无法取 CSS 变量）。 */
const SEARCH_ICON_COLOR = "#8a90a3";
const SEARCH_PLACEHOLDER_STYLE =
  "color:#8a90a3;font-size:13px;line-height:19px";

const selectionStore = useSelectionStore();
const {
  items,
  status,
  loadingMore,
  loadMoreFailed,
  categoryId,
  keyword,
  hasMore,
  isEmpty,
  reload,
  loadMore,
  setCategory,
  search,
} = useProductList();

const categories = ref<WxCategory[]>([]);
const activeCategoryId = ref<number | null>(null);
const inputText = ref("");

const selectedProducts = computed(() => selectionStore.selectedProducts);
const selectedCount = computed((): number => selectionStore.selectedCount);
const countText = computed((): string => selectedCountText(selectedCount.value));
const thumbs = computed(() => thumbnailsOf(selectedProducts.value));

const showFooter = computed(
  (): boolean =>
    status.value === "ready" &&
    items.value.length > 0 &&
    (loadingMore.value || loadMoreFailed.value || !hasMore.value)
);

const footerText = computed((): string => {
  if (loadingMore.value) return "加载中…";
  if (loadMoreFailed.value) return "加载失败，点击重试";
  return "没有更多了";
});

const emptyText = computed((): string =>
  keyword.value !== ""
    ? `未找到「${keyword.value}」相关产品`
    : "该分类下暂无产品"
);

const debouncedSearch = debounce((raw: string): void => {
  void applyKeyword(raw);
}, SEARCH_DEBOUNCE_MS);

onLoad(() => {
  void bootstrap();
});

onUnload(() => {
  debouncedSearch.cancel();
});

async function bootstrap(): Promise<void> {
  await loadCategories();
  const first = categories.value[0];
  if (first !== undefined) {
    activeCategoryId.value = first.id;
    await setCategory(first.id);
    return;
  }
  await reload();
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await getCategories();
  } catch {
    // 分类接口失败不阻塞产品区：右栏回退全量列表（导航标题固定，不受影响）
    categories.value = [];
  }
}

/**
 * 关键词搜索（300ms 防抖后调用）。按型号过滤跨全部产品：
 * 搜索期间清掉分类条件，避免「分类 + 型号」双约束导致大量空结果。
 * 清空搜索时恢复到高亮的分类。
 */
async function applyKeyword(raw: string): Promise<void> {
  const trimmed = raw.trim();
  if (trimmed === "") {
    await restoreCategory(activeCategoryId.value);
    return;
  }
  if (categoryId.value !== null) {
    await setCategory(null);
  }
  await search(trimmed);
}

/** 退出搜索并回到指定分类（null 回退全量列表）。 */
async function restoreCategory(id: number | null): Promise<void> {
  if (keyword.value !== "") {
    await search("");
  }
  if (id !== null) {
    await setCategory(id);
  } else {
    await reload();
  }
}

function onCategoryTap(id: number): void {
  if (id === activeCategoryId.value && keyword.value === "") return;
  activeCategoryId.value = id;
  debouncedSearch.cancel();
  inputText.value = "";
  void restoreCategory(id);
}

/** 小程序 input 事件载荷（`detail.value`）。 */
function onInput(event: Event): void {
  const value = (event as CustomEvent<{ value: string }>).detail?.value ?? "";
  inputText.value = value;
  debouncedSearch(value);
}

function onSearchConfirm(): void {
  debouncedSearch.cancel();
  void applyKeyword(inputText.value);
}

function onClearKeyword(): void {
  debouncedSearch.cancel();
  inputText.value = "";
  void applyKeyword("");
}

function isSelected(productId: number): boolean {
  return isProductSelected(selectedProducts.value, productId);
}

function onToggleProduct(product: WxProductListItem): void {
  if (isSelected(product.id)) {
    selectionStore.removeProduct(product.id);
    return;
  }
  selectionStore.addProduct(toSelectionProduct(product));
}

function onThumbRemove(productId: number): void {
  selectionStore.removeProduct(productId);
}

function onOpenDetail(product: WxProductListItem): void {
  uni.navigateTo({
    url: `/pages/product/detail?id=${product.id}`,
    fail: () => {
      uni.showToast({ title: "产品详情页建设中", icon: "none" });
    },
  });
}

/**
 * OK → 方案编辑页（MP-05B 未落地前 navigateTo fail → toast 兜底）。
 * 选品始终留在 Pinia，跳转失败不丢状态。
 */
function onOk(): void {
  uni.navigateTo({
    url: SCHEME_EDIT_PAGE,
    fail: () => {
      uni.showToast({ title: SCHEME_EDIT_PENDING_TOAST, icon: "none" });
    },
  });
}

function onScrollToLower(): void {
  void loadMore();
}

function onFooterTap(): void {
  if (loadMoreFailed.value) void loadMore();
}
</script>

<template>
  <view class="ss-page">
    <WechatNav :title="SELECTION_NAV_TITLE" back />

    <!-- ① 搜索区域（px16 py12；框 327×36 圆角 18） -->
    <view class="ss-search-area">
      <view class="ss-search-box">
        <view class="ss-search-icon">
          <Icon name="search" :size="16" :color="SEARCH_ICON_COLOR" />
        </view>
        <input
          class="ss-search-input"
          type="text"
          :value="inputText"
          :placeholder="SELECTION_SEARCH_PLACEHOLDER"
          :placeholder-style="SEARCH_PLACEHOLDER_STYLE"
          confirm-type="search"
          @input="onInput"
          @confirm="onSearchConfirm"
        />
        <view v-if="inputText !== ''" class="ss-search-clear" @tap="onClearKeyword">
          <text class="ss-search-clear-icon">×</text>
        </view>
      </view>
    </view>

    <!-- ② 左右双栏：分类导航（94）+ 产品网格（自适应宽，Q10） -->
    <view class="ss-body">
      <view class="ss-cats">
        <view
          v-for="category in categories"
          :key="category.id"
          class="ss-cat-item"
          :class="{ 'ss-cat-item--active': category.id === activeCategoryId }"
          @tap="onCategoryTap(category.id)"
        >
          <view
            v-if="category.id === activeCategoryId"
            class="ss-cat-indicator"
          />
          <text class="ss-cat-text">{{ category.name }}</text>
        </view>
      </view>

      <scroll-view
        class="ss-products"
        scroll-y
        :show-scrollbar="false"
        lower-threshold="100"
        @scrolltolower="onScrollToLower"
      >
        <view v-if="status === 'loading'" class="ss-state">
          <text class="ss-state-text">加载中…</text>
        </view>
        <view v-else-if="status === 'error'" class="ss-state">
          <text class="ss-state-text">产品列表加载失败</text>
          <view class="ss-state-retry" @tap="reload">
            <text class="ss-state-retry-text">重试</text>
          </view>
        </view>
        <view v-else-if="isEmpty" class="ss-state">
          <!-- Q8 DEFERRED：空结果不做插图 -->
          <text class="ss-state-text">{{ emptyText }}</text>
        </view>
        <view v-else class="ss-grid">
          <view
            v-for="product in items"
            :key="product.id"
            class="ss-card"
            @tap="onOpenDetail(product)"
          >
            <view class="ss-card-media">
              <image
                v-if="product.main_image"
                class="ss-card-image"
                :src="absoluteUrl(product.main_image)"
                mode="aspectFill"
                lazy-load
              />
            </view>
            <view class="ss-card-info">
              <text class="ss-card-name">{{ product.name }}</text>
              <text v-if="specTextOf(product)" class="ss-card-spec">
                {{ specTextOf(product) }}
              </text>
              <view class="ss-card-tags">
                <view
                  v-if="sleepFeelTagOf(product) !== ''"
                  class="ss-card-feel"
                >
                  <text class="ss-card-feel-text">{{ sleepFeelTagOf(product) }}</text>
                </view>
                <view class="ss-card-detail">
                  <text class="ss-card-detail-text">{{ DETAIL_LABEL }}</text>
                </view>
              </view>
              <!-- Q13：视觉 21×21，透明热区 44×44（不触发卡片打开详情） -->
              <view
                class="ss-card-action"
                :class="{
                  'ss-card-action--selected': isSelected(product.id),
                }"
                @tap.stop="onToggleProduct(product)"
              >
                <view class="ss-card-action-btn">
                  <text class="ss-card-action-icon">
                    {{ isSelected(product.id) ? "✓" : "+" }}
                  </text>
                </view>
              </view>
            </view>
          </view>
          <view v-if="showFooter" class="ss-footer" @tap="onFooterTap">
            <text class="ss-footer-text">{{ footerText }}</text>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- ③ 已选栏（bg navy p12 gap10） -->
    <view class="ss-selected-bar">
      <scroll-view
        class="ss-thumb-area"
        scroll-x
        :show-scrollbar="false"
      >
        <view class="ss-thumb-track">
          <view
            v-for="product in thumbs"
            :key="product.id"
            class="ss-thumb"
            @tap="onThumbRemove(product.id)"
          >
            <image
              v-if="product.main_image"
              class="ss-thumb-image"
              :src="absoluteUrl(product.main_image)"
              mode="aspectFill"
            />
            <text class="ss-thumb-remove">×</text>
          </view>
        </view>
      </scroll-view>
      <text class="ss-count">{{ countText }}</text>
      <view class="ss-ok" @tap="onOk">
        <text class="ss-ok-text">{{ OK_LABEL }}</text>
      </view>
    </view>
    <SafeArea background="#1a2260" />
  </view>
</template>

<style lang="scss" scoped>
.ss-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: $color-text-inv;
}

/* ---------------- ① 搜索区域（px16 py12） ---------------- */
.ss-search-area {
  flex-shrink: 0;
  padding: $space-12 $space-16;
  box-sizing: border-box;
}

.ss-search-box {
  position: relative;
  width: 327px;
  max-width: 100%;
  height: 36px;
  border-radius: $radius-18;
  background-color: $color-fill;
}

/* 搜索图标 16×16 left14 top10 */
.ss-search-icon {
  position: absolute;
  top: $space-10;
  left: 14px;
  width: 16px;
  height: 16px;
}

/* 占位文字 left38 top9，行高 19 */
.ss-search-input {
  width: 100%;
  height: 36px;
  padding-left: $space-32 + $space-6; /* 38 = 图标 16 + left14 + 间距 8 */
  padding-right: $space-32;
  box-sizing: border-box;
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13-fixed;
  color: $color-text-1;
}

.ss-search-clear {
  position: absolute;
  top: $space-8;
  right: $space-8;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: $radius-pill;
  background-color: $color-line;
}

.ss-search-clear-icon {
  font-size: $font-12;
  line-height: $line-height-12;
  color: $color-text-3;
}

/* ---------------- ② 左右双栏 ---------------- */
.ss-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* 分类导航：宽 94，bg fill，gap4；高度随条目自适应（下方留白） */
.ss-cats {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-self: flex-start;
  gap: $space-4;
  width: 94px;
  background-color: $color-fill;
}

/* 每项 h56 px8，文字 Regular 12 居中 */
.ss-cat-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  padding: 0 $space-8;
  box-sizing: border-box;
}

.ss-cat-item--active {
  background-color: $color-text-inv;
}

/* 当前分类左侧指示条 3×16 bg yellow top20 */
.ss-cat-indicator {
  position: absolute;
  top: $space-20;
  left: 0;
  width: 3px;
  height: 16px;
  background-color: $color-yellow;
}

.ss-cat-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-2;
  text-align: center;
}

.ss-cat-item--active .ss-cat-text {
  color: $color-navy;
}

/* 可选产品区：自适应宽（Q10：不硬编码 126.92px），bg fill，px9 pb12，行距 10 */
.ss-products {
  flex: 1;
  min-width: 0;
  height: 100%;
  background-color: $color-fill;
}

.ss-grid {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  row-gap: $space-10;
  column-gap: $space-8;
  padding: 0 $space-9 $space-12;
  box-sizing: border-box;
}

/* 卡宽 = (容器 - 列间距 8) / 2，随屏宽自适应 */
.ss-card {
  position: relative;
  width: calc((100% - #{$space-8}) / 2);
  height: 187px;
  overflow: hidden;
  border-radius: $radius-12;
  background-color: $color-text-inv;
  box-shadow: $shadow-card;
}

/* 主图 114 高 object-cover 贴顶 */
.ss-card-media {
  position: relative;
  width: 100%;
  height: 114px;
  overflow: hidden;
  background-color: $color-fill;
}

.ss-card-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* 内容区：left9 top119，宽随卡自适应（左右各 9） */
.ss-card-info {
  position: absolute;
  top: 119px;
  left: $space-9;
  right: $space-9;
  height: 62px;
}

/* 产品名 Medium 10（Q11：取整自 9.88），lh1.45 */
.ss-card-name {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  font-family: $font-family-cn;
  font-size: $font-10;
  font-weight: $font-weight-medium;
  line-height: $line-height-12;
  color: $color-text-1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 规格 Inter Regular 8（Q11：取整自 7.6），lh1.5，top16 */
.ss-card-spec {
  position: absolute;
  top: 16px;
  left: 0;
  width: 100%;
  font-family: $font-family-en;
  font-size: 8px;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-text-3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 标签行 top29 h17：舒适睡感 55×17 圆角8 + 查看详情 44×15 圆角3 */
.ss-card-tags {
  position: absolute;
  top: 29px;
  left: 0;
  display: flex;
  align-items: center;
  gap: $space-4;
  height: 17px;
}

.ss-card-feel {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 55px;
  height: 17px;
  border-radius: $radius-8;
  background-color: $color-yellow-soft;
}

.ss-card-feel-text {
  font-family: $font-family-cn;
  font-size: 8px;
  font-weight: $font-weight-medium;
  line-height: $line-height-10;
  color: $color-yellow-deep;
  white-space: nowrap;
}

.ss-card-detail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 15px;
  border-radius: $radius-4;
  background-color: $color-fill;
}

.ss-card-detail-text {
  font-family: $font-family-cn;
  font-size: 8px;
  font-weight: $font-weight-regular;
  line-height: $line-height-10;
  color: $color-text-3;
  white-space: nowrap;
}

/* Q13：透明热区 44×44（视觉 21×21 贴内容区右缘，top 居中于 37） */
.ss-card-action {
  position: absolute;
  top: 26px;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 44px;
  height: 44px;
}

.ss-card-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  border-radius: $radius-11;
  background-color: $color-yellow;
}

.ss-card-action-icon {
  font-family: $font-family-en;
  font-size: $font-14;
  font-weight: $font-weight-regular;
  line-height: $line-height-14;
  color: $color-navy;
}

.ss-card-action--selected .ss-card-action-btn {
  background-color: $color-line;
}

.ss-card-action--selected .ss-card-action-icon {
  font-size: $font-11;
  color: $color-text-3;
}

.ss-footer {
  width: 100%;
  padding: $space-12 0 $space-8;
  text-align: center;
}

.ss-footer-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  color: $color-text-3;
}

/* 状态（加载/错误/空；Q8：不做插图） */
.ss-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-12;
  padding: $space-60 $space-16;
}

.ss-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  color: $color-text-3;
  text-align: center;
}

.ss-state-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 21px;
  padding: 0 $space-16;
  border-radius: $radius-pill;
  background-color: $color-yellow;
}

.ss-state-retry-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-semibold;
  color: $color-navy;
}

/* ---------------- ③ 已选栏 ---------------- */
.ss-selected-bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: $space-10;
  padding: $space-12;
  box-sizing: border-box;
  background-color: $color-navy;
}

/* 已选缩略图区：宽 150 gap6（横向滚动，全部缩略图均可移除） */
.ss-thumb-area {
  flex-shrink: 0;
  width: 150px;
  height: 55px;
  white-space: nowrap;
}

.ss-thumb-track {
  display: inline-flex;
  gap: $space-6;
}

/* 可移除缩略图 49×55 圆角 4 bg cream（Q13：整块 49×55 为热区） */
.ss-thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 49px;
  height: 55px;
  overflow: hidden;
  border-radius: $radius-4;
  background-color: $color-cream;
}

.ss-thumb-image {
  width: 49px;
  height: 38px;
}

.ss-thumb-remove {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: $font-family-en;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-navy;
}

.ss-count {
  flex: 1;
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-regular;
  line-height: $line-height-12;
  color: $color-text-inv;
  text-align: center;
}

.ss-ok {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 90px;
  height: 42px;
  border-radius: $radius-20;
  background-color: $color-yellow;
}

.ss-ok-text {
  font-family: $font-family-cn;
  font-size: $font-15;
  font-weight: $font-weight-medium;
  line-height: $line-height-15-fixed;
  color: $color-navy;
}
</style>
