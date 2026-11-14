<script setup lang="ts">
/**
 * 产品列表页（MP-03 骨架，**待 MP-03B 按 V3 重写**）。
 *
 * ⚠️ 本页视觉依据是已作废的 V2.0 旧稿（jp/ 已删除），且结构不符 V3：
 * V3 产品页无左侧分类侧边导航、无底部已选栏（那些属选品页 MP-05A）。
 * MP-03B 会重写本页。当前仅作功能骨架保留。
 *
 * token 沿用设计基线（LEKASI navy #1A2260 / yellow #F7C400 / cream #FDFBF5）。
 * 搜索栏（300ms 防抖 + 本地历史 10 条）/ 分类侧边导航 / 排序 Tab（综合/推荐/新品）/
 * 宫格·列表视图切换 / 产品卡片选款 / 底部已选栏。数据接 GET /wxapi/products + /wxapi/categories。
 */
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import {
  getCategories,
  SORT_TABS,
  toSelectionProduct,
  type ProductSortTab,
} from "@/api/product";
import ProductCard from "@/components/product/ProductCard.vue";
import SelectedBar from "@/components/product/SelectedBar.vue";
import SelectFab from "@/components/frame/SelectFab.vue";
import { SCHEME_EDIT_PAGE } from "@/config";
import { useProductList } from "@/composables/useProductList";
import { useProductFilterStore } from "@/stores/useProductFilterStore";
import { useSelectionStore } from "@/stores/useSelectionStore";
import type { WxCategory } from "@/types/home";
import type { WxProductListItem } from "@/types/product";
import { debounce } from "@/utils/debounce";
import {
  clearSearchHistory,
  loadSearchHistory,
  pushSearchHistory,
} from "@/utils/searchHistory";

const SEARCH_DEBOUNCE_MS = 300;
const HISTORY_HIDE_DELAY_MS = 200;

const filterStore = useProductFilterStore();
const selectionStore = useSelectionStore();
const {
  items,
  status,
  loadingMore,
  loadMoreFailed,
  categoryId,
  keyword,
  sortTab,
  hasMore,
  isEmpty,
  reload,
  loadMore,
  setCategory,
  setSortTab,
  search,
} = useProductList();

const categories = ref<WxCategory[]>([]);
const categoriesFailed = ref(false);
const inputText = ref("");
const history = ref<string[]>([]);
const panelOpen = ref(false);
const viewMode = ref<"grid" | "list">("grid");

let initialized = false;
let historyHideTimer: ReturnType<typeof setTimeout> | null = null;

const showHistoryPanel = computed(
  (): boolean =>
    panelOpen.value && inputText.value.trim() === "" && history.value.length > 0
);

const selectedIdSet = computed(
  (): Set<number> =>
    new Set(selectionStore.selectedProducts.map((product) => product.id))
);

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

const debouncedSearch = debounce((raw: string): void => {
  const trimmed = raw.trim();
  if (trimmed !== "") {
    history.value = pushSearchHistory(trimmed);
    panelOpen.value = false;
  } else {
    panelOpen.value = true;
  }
  void search(raw);
}, SEARCH_DEBOUNCE_MS);

onLoad(() => {
  history.value = loadSearchHistory();
  void loadCategories();
});

onShow(() => {
  // 首页寝具入口经 Pinia 传入的型号关键词（Q15：9B/9D/9P → 产品页搜索）
  const requestedKeyword = filterStore.requestedKeyword;
  if (requestedKeyword !== null) {
    filterStore.clearRequest();
    initialized = true;
    inputText.value = requestedKeyword;
    history.value = pushSearchHistory(requestedKeyword);
    void applyKeyword(requestedKeyword);
    return;
  }
  // 首页分类卡 / jump_type=2 banner 经 Pinia 传入的分类（switchTab 不带参，核心约定 9）
  const requested = filterStore.requestedCategoryId;
  if (requested !== null) {
    filterStore.clearRequest();
    initialized = true;
    if (keyword.value !== "") {
      // 分类与关键词互斥：切分类时清掉残留的型号搜索，避免双条件空结果
      inputText.value = "";
      void search("");
    }
    void setCategory(requested);
    return;
  }
  if (!initialized) {
    initialized = true;
    void reload();
  }
});

/** 型号搜索：先清掉分类条件，保证 keyword 单独生效（与 store 的互斥语义一致）。 */
async function applyKeyword(nextKeyword: string): Promise<void> {
  if (categoryId.value !== null) {
    await setCategory(null);
  }
  await search(nextKeyword);
}

onUnload(() => {
  debouncedSearch.cancel();
  cancelHistoryHide();
});

async function loadCategories(): Promise<void> {
  categoriesFailed.value = false;
  try {
    categories.value = await getCategories();
  } catch {
    categories.value = [];
    categoriesFailed.value = true;
  }
}

/** 小程序 input 事件载荷（`detail.value`）；vue-tsc 按 DOM Event 校验，故用 CustomEvent 兼容取窄。 */
function onInput(event: Event): void {
  const value = (event as CustomEvent<{ value: string }>).detail?.value ?? "";
  inputText.value = value;
  debouncedSearch(value);
}

function onSearchConfirm(): void {
  debouncedSearch.cancel();
  const trimmed = inputText.value.trim();
  if (trimmed !== "") {
    history.value = pushSearchHistory(trimmed);
  }
  panelOpen.value = false;
  void search(inputText.value);
}

function onClearKeyword(): void {
  debouncedSearch.cancel();
  cancelHistoryHide();
  inputText.value = "";
  panelOpen.value = true;
  void search("");
}

function onInputFocus(): void {
  cancelHistoryHide();
  panelOpen.value = true;
}

function onInputBlur(): void {
  cancelHistoryHide();
  // 延迟隐藏：让历史 chip 的 tap 先于面板消失触发
  historyHideTimer = setTimeout(() => {
    panelOpen.value = false;
    historyHideTimer = null;
  }, HISTORY_HIDE_DELAY_MS);
}

function cancelHistoryHide(): void {
  if (historyHideTimer !== null) {
    clearTimeout(historyHideTimer);
    historyHideTimer = null;
  }
}

function onHistoryTap(historyKeyword: string): void {
  cancelHistoryHide();
  debouncedSearch.cancel();
  inputText.value = historyKeyword;
  panelOpen.value = false;
  history.value = pushSearchHistory(historyKeyword);
  void search(historyKeyword);
}

function onClearHistory(): void {
  clearSearchHistory();
  history.value = [];
  panelOpen.value = false;
}

function onCategoryTap(nextCategoryId: number | null): void {
  void setCategory(nextCategoryId);
}

function onSortTap(tab: ProductSortTab): void {
  void setSortTab(tab);
}

function toggleViewMode(): void {
  viewMode.value = viewMode.value === "grid" ? "list" : "grid";
}

function onCardAdd(product: WxProductListItem): void {
  if (selectedIdSet.value.has(product.id)) {
    uni.showToast({ title: "已在选品中", icon: "none" });
    return;
  }
  selectionStore.addProduct(toSelectionProduct(product));
}

function onCardOpen(product: WxProductListItem): void {
  // 详情页 MP-04 落地前回退提示（与首页 jump 分发同模式）
  uni.navigateTo({
    url: `/pages/product/detail?id=${product.id}`,
    fail: () => {
      uni.showToast({ title: "产品详情页建设中（MP-04）", icon: "none" });
    },
  });
}

function onBarRemove(productId: number): void {
  selectionStore.removeProduct(productId);
}

function onBarOk(): void {
  // MP-05 落地前无现有页面可承载已选清单：回退 toast 并保留选品（Pinia），目标仅改配置常量
  uni.navigateTo({
    url: SCHEME_EDIT_PAGE,
    fail: () => {
      uni.showToast({
        title: `方案编辑建设中（MP-05），已保留 ${selectionStore.selectedCount} 款选品`,
        icon: "none",
      });
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
  <view class="pl-page">
    <view class="pl-header">
      <view class="pl-search-wrap">
        <view class="pl-search-row">
          <view class="pl-search-box">
            <view class="pl-search-icon">
              <view class="pl-search-icon-handle" />
            </view>
            <input
              class="pl-search-input"
              type="text"
              :value="inputText"
              placeholder="搜索产品 / 型号"
              confirm-type="search"
              @input="onInput"
              @focus="onInputFocus"
              @blur="onInputBlur"
              @confirm="onSearchConfirm"
            />
            <view
              v-if="inputText !== ''"
              class="pl-search-clear"
              @tap="onClearKeyword"
            >
              <text class="pl-search-clear-icon">×</text>
            </view>
          </view>
          <view class="pl-view-toggle" @tap="toggleViewMode">
            <text class="pl-view-toggle-text">{{
              viewMode === "grid" ? "列表" : "宫格"
            }}</text>
          </view>
        </view>
        <view v-if="showHistoryPanel" class="pl-history">
          <view class="pl-history-head">
            <text class="pl-history-title">搜索历史</text>
            <text class="pl-history-clear" @tap="onClearHistory">清空</text>
          </view>
          <view class="pl-history-chips">
            <view
              v-for="historyKeyword in history"
              :key="historyKeyword"
              class="pl-history-chip"
              @tap="onHistoryTap(historyKeyword)"
            >
              <text class="pl-history-chip-text">{{ historyKeyword }}</text>
            </view>
          </view>
        </view>
      </view>
      <view class="pl-sort-row">
        <view
          v-for="tab in SORT_TABS"
          :key="tab.key"
          class="pl-sort-tab"
          :class="sortTab === tab.key ? 'pl-sort-tab--active' : ''"
          @tap="onSortTap(tab.key)"
        >
          <text class="pl-sort-tab-text">{{ tab.label }}</text>
        </view>
      </view>
    </view>

    <view class="pl-body">
      <scroll-view class="pl-side" scroll-y :show-scrollbar="false">
        <view
          class="pl-side-item"
          :class="categoryId === null ? 'pl-side-item--active' : ''"
          @tap="onCategoryTap(null)"
        >
          <text class="pl-side-item-text">全部</text>
        </view>
        <view
          v-for="category in categories"
          :key="category.id"
          class="pl-side-item"
          :class="categoryId === category.id ? 'pl-side-item--active' : ''"
          @tap="onCategoryTap(category.id)"
        >
          <text class="pl-side-item-text">{{ category.name }}</text>
        </view>
        <view
          v-if="categoriesFailed"
          class="pl-side-item"
          @tap="loadCategories"
        >
          <text class="pl-side-item-text">分类加载失败 重试</text>
        </view>
      </scroll-view>

      <scroll-view
        class="pl-main"
        scroll-y
        :show-scrollbar="false"
        lower-threshold="100"
        @scrolltolower="onScrollToLower"
      >
        <view v-if="status === 'loading'" class="pl-state">
          <text class="pl-state-text">加载中…</text>
        </view>
        <view v-else-if="status === 'error'" class="pl-state">
          <text class="pl-state-text">产品列表加载失败</text>
          <view class="pl-state-retry" @tap="reload">
            <text class="pl-state-retry-text">重试</text>
          </view>
        </view>
        <view v-else-if="isEmpty" class="pl-state">
          <text class="pl-state-text">{{
            keyword !== ""
              ? `未找到「${keyword}」相关产品`
              : "该分类下暂无产品"
          }}</text>
          <view
            v-if="keyword !== ''"
            class="pl-state-retry"
            @tap="onClearKeyword"
          >
            <text class="pl-state-retry-text">清空搜索</text>
          </view>
        </view>
        <view
          v-else
          class="pl-cards"
          :class="viewMode === 'grid' ? 'pl-cards--grid' : 'pl-cards--list'"
        >
          <ProductCard
            v-for="product in items"
            :key="product.id"
            class="pl-card"
            :product="product"
            :mode="viewMode"
            :added="selectedIdSet.has(product.id)"
            @add="onCardAdd"
            @open="onCardOpen"
          />
        </view>
        <view v-if="showFooter" class="pl-footer" @tap="onFooterTap">
          <text class="pl-footer-text">{{ footerText }}</text>
        </view>
      </scroll-view>
    </view>

    <SelectedBar
      v-if="selectionStore.selectedCount > 0"
      :products="selectionStore.selectedProducts"
      @remove="onBarRemove"
      @ok="onBarOk"
    />
    <SelectFab v-if="selectionStore.selectedCount === 0" />
  </view>
</template>

<style scoped>
.pl-page {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: #fdfbf5;
}

.pl-header {
  flex-shrink: 0;
  background-color: #fdfbf5;
}

.pl-search-wrap {
  position: relative;
  padding: 16rpx 32rpx;
}

.pl-search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.pl-search-box {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 16rpx;
  height: 72rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background-color: #f4f6fa;
}

.pl-search-icon {
  position: relative;
  flex-shrink: 0;
  width: 26rpx;
  height: 26rpx;
  border: 3rpx solid #8a90a3;
  border-radius: 50%;
}

.pl-search-icon-handle {
  position: absolute;
  right: -9rpx;
  bottom: -6rpx;
  width: 12rpx;
  height: 3rpx;
  background-color: #8a90a3;
  transform: rotate(45deg);
}

.pl-search-input {
  flex: 1;
  height: 72rpx;
  font-size: 26rpx;
  color: #1e2330;
}

.pl-search-clear {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background-color: #e3e5ec;
}

.pl-search-clear-icon {
  font-size: 26rpx;
  line-height: 1;
  color: #8a90a3;
}

.pl-view-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 56rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background-color: #f4f6fa;
}

.pl-view-toggle-text {
  font-size: 24rpx;
  color: #1a2260;
}

.pl-history {
  position: absolute;
  top: calc(100% - 8rpx);
  left: 32rpx;
  right: 32rpx;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background-color: #ffffff;
  box-shadow: 0 8rpx 24rpx rgba(30, 35, 48, 0.12);
}

.pl-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pl-history-title {
  font-size: 24rpx;
  color: #8a90a3;
}

.pl-history-clear {
  font-size: 24rpx;
  color: #1a2260;
}

.pl-history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.pl-history-chip {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background-color: #f4f6fa;
}

.pl-history-chip-text {
  font-size: 24rpx;
  color: #1e2330;
}

.pl-sort-row {
  display: flex;
  gap: 48rpx;
  padding: 0 32rpx;
}

.pl-sort-tab {
  padding: 12rpx 0 16rpx;
  border-bottom: 4rpx solid transparent;
}

.pl-sort-tab--active {
  border-bottom-color: #f7c400;
}

.pl-sort-tab-text {
  font-size: 28rpx;
  color: #8a90a3;
}

.pl-sort-tab--active .pl-sort-tab-text {
  font-weight: 600;
  color: #1a2260;
}

.pl-body {
  display: flex;
  flex: 1;
  height: 0;
}

.pl-side {
  flex-shrink: 0;
  width: 168rpx;
  height: 100%;
  background-color: #f4f6fa;
}

.pl-side-item {
  padding: 32rpx 12rpx;
  border-left: 6rpx solid transparent;
  text-align: center;
}

.pl-side-item--active {
  border-left-color: #f7c400;
  background-color: #fdfbf5;
}

.pl-side-item-text {
  font-size: 26rpx;
  color: #5a6072;
}

.pl-side-item--active .pl-side-item-text {
  font-weight: 600;
  color: #1a2260;
}

.pl-main {
  flex: 1;
  height: 100%;
}

.pl-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 120rpx 32rpx;
}

.pl-state-text {
  font-size: 26rpx;
  color: #8a90a3;
  text-align: center;
}

.pl-state-retry {
  padding: 16rpx 64rpx;
  border-radius: 999rpx;
  background-color: #f7c400;
}

.pl-state-retry-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a2260;
}

.pl-cards {
  /* 底部留白：避免固定已选栏/悬浮按钮遮挡末尾卡片 */
  padding: 16rpx 16rpx 200rpx;
}

.pl-cards--grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.pl-cards--grid .pl-card {
  width: calc((100% - 16rpx) / 2);
}

.pl-cards--list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.pl-footer {
  padding: 24rpx 0 40rpx;
  text-align: center;
}

.pl-footer-text {
  font-size: 24rpx;
  color: #8a90a3;
}
</style>
