<script setup lang="ts">
/**
 * 产品页（MP-03B，V3 二级页）
 *
 * 真值来源：docs/design/references/product-list.png + design-spec/spec.md §5.3 +
 * open-questions.md Q5（排序规则延后，推荐回退综合）/ Q6（视图切换延后，图标可点仍网格）/
 * Q8（缺失态不做插图）/ Q12（跳过版本条）。
 *
 * 结构：微信导航（二级页，标题=分类名）→ 搜索 + 排序 → 2 列产品网格 → TabBar two。
 * V3 产品页**没有**左侧分类侧栏、底部已选栏、列表视图产物（均属选品页 MP-05A / 已延后）。
 *
 * 数据层复用：api/product.ts、composables/useProductList.ts（竞态防护 + 分页）、
 * utils/debounce.ts（300ms）、utils/searchHistory.ts（10 条）。
 * 跨页传参：分类页以 category_id 查询参数进入；首页寝具/分类卡经 Pinia 转发（核心约定 9）。
 */
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import { getCategories, SORT_TABS, type ProductSortTab } from "@/api/product";
import ProductCard from "@/components/product/ProductCard.vue";
import {
  DETAIL_PENDING_TOAST,
  SEARCH_PLACEHOLDER,
  parseCategoryId,
  productDetailUrlOf,
  resolvePageTitle,
} from "@/components/product/productListModel";
import SafeArea from "@/components/frame/SafeArea.vue";
import TabBar from "@/components/frame/TabBar.vue";
import WechatNav from "@/components/frame/WechatNav.vue";
import Icon from "@/components/icons/Icon.vue";
import { useProductList } from "@/composables/useProductList";
import { useProductFilterStore } from "@/stores/useProductFilterStore";
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

/** 图标/占位色镜像 token（Icon 的 color 进 SVG data URI，无法取 CSS 变量）。 */
const SEARCH_ICON_COLOR = "#8a90a3";
const LIST_ICON_COLOR = "#4a5165";
const SEARCH_PLACEHOLDER_STYLE =
  "color:#8a90a3;font-size:13px;line-height:19px";

const filterStore = useProductFilterStore();
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
const queryCategoryName = ref("");
const inputText = ref("");
const history = ref<string[]>([]);
const panelOpen = ref(false);

let initialized = false;
/** onLoad 收到的 category_id（onShow 首次执行时消费，避免与 Pinia 通道抢跑）。 */
let pendingQueryCategoryId: number | null = null;
/** onLoad 收到的 keyword（首页寝具入口直达时携带）。 */
let pendingQueryKeyword: string | null = null;
let historyHideTimer: ReturnType<typeof setTimeout> | null = null;

const pageTitle = computed((): string =>
  resolvePageTitle(categoryId.value, categories.value, queryCategoryName.value)
);

const showHistoryPanel = computed(
  (): boolean =>
    panelOpen.value && inputText.value.trim() === "" && history.value.length > 0
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

const emptyText = computed((): string =>
  keyword.value !== ""
    ? `未找到「${keyword.value}」相关产品`
    : "该分类下暂无产品"
);

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

onLoad((options) => {
  history.value = loadSearchHistory();
  queryCategoryName.value =
    typeof options?.category_name === "string" ? options.category_name : "";
  pendingQueryCategoryId = parseCategoryId(options?.category_id);
  // 首页寝具入口直达本页时带 keyword=9B（Q15），优先于 Pinia 通道
  pendingQueryKeyword =
    typeof options?.keyword === "string" && options.keyword !== "" ? options.keyword : null;
  void loadCategories();
});

onShow(() => {
  // URL 传入的 category_id 优先（首页系列卡 / 分类页直达）
  if (pendingQueryCategoryId !== null) {
    const queryCategoryId = pendingQueryCategoryId;
    pendingQueryCategoryId = null;
    initialized = true;
    void setCategory(queryCategoryId);
    return;
  }
  // URL 传入的 keyword（首页寝具入口直达）
  if (pendingQueryKeyword !== null) {
    const queryKeyword = pendingQueryKeyword;
    pendingQueryKeyword = null;
    initialized = true;
    inputText.value = queryKeyword;
    history.value = pushSearchHistory(queryKeyword);
    void applyKeyword(queryKeyword);
    return;
  }
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
  // 首页分类卡经分类页转发的分类请求（兜底通道）
  const requested = filterStore.requestedCategoryId;
  if (requested !== null) {
    filterStore.clearRequest();
    initialized = true;
    if (keyword.value !== "") {
      // 分类与关键词互斥：切分类时清掉残留的型号搜索
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

onUnload(() => {
  debouncedSearch.cancel();
  cancelHistoryHide();
});

/** 型号搜索：先清掉分类条件，保证 keyword 单独生效（与 store 的互斥语义一致）。 */
async function applyKeyword(nextKeyword: string): Promise<void> {
  if (categoryId.value !== null) {
    await setCategory(null);
  }
  await search(nextKeyword);
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await getCategories();
  } catch {
    // 标题解析失败不影响列表主流程，导航标题回退 query 名称 / 「产品」
    categories.value = [];
  }
}

/** 小程序 input 事件载荷（`detail.value`）；vue-tsc 按 DOM Event 校验，故取窄。 */
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

function onSortTap(tab: ProductSortTab): void {
  void setSortTab(tab);
}

/** Q6 DEFERRED：视图切换图标保留可点，但仍为网格（不产出列表视图）。 */
function onViewToggle(): void {
  uni.showToast({ title: "列表视图建设中", icon: "none" });
}

function onCardOpen(product: WxProductListItem): void {
  uni.navigateTo({
    url: productDetailUrlOf(product.id),
    fail: () => {
      // MP-04 未落地：不留死链，提示并停留当前页
      uni.showToast({ title: DETAIL_PENDING_TOAST, icon: "none" });
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
    <WechatNav :title="pageTitle" back class="nav-anchor" :data-nav-title="pageTitle" :data-nav-back="1" />

    <!-- ① 筛选区域：搜索与视图行 + 排序行 -->
    <view class="pl-head">
      <view class="pl-search-wrap">
        <view class="pl-search-row">
          <view class="pl-search-box">
            <view class="pl-search-icon">
              <Icon name="search" :size="16" :color="SEARCH_ICON_COLOR" />
            </view>
            <input
              class="pl-search-input"
              type="text"
              :value="inputText"
              :placeholder="SEARCH_PLACEHOLDER"
              :placeholder-style="SEARCH_PLACEHOLDER_STYLE"
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
          <view class="pl-view-toggle" @tap="onViewToggle">
            <Icon name="list" :size="22" :color="LIST_ICON_COLOR" />
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
          <view v-if="sortTab === tab.key" class="pl-sort-indicator" />
        </view>
      </view>
    </view>

    <!-- ② 产品网格（两列，卡 167×246） -->
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
        <text class="pl-state-text">{{ emptyText }}</text>
        <view v-if="keyword !== ''" class="pl-state-retry" @tap="onClearKeyword">
          <text class="pl-state-retry-text">清空搜索</text>
        </view>
      </view>
      <view v-else class="pl-grid">
        <ProductCard
          v-for="product in items"
          :key="product.id"
          class="pl-card"
          :product="product"
          :data-pcard-id="product.id"
          :data-pcard-name="product.name"
          :data-pcard-spec="product.spec || ''"
          :data-pcard-feel="product.sleep_feel || ''"
          @open="onCardOpen"
        />
        <view v-if="showFooter" class="pl-footer" @tap="onFooterTap">
          <text class="pl-footer-text">{{ footerText }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- ③ 底部 TabBar two（首页 / 返回） -->
    <view class="pl-tabbar">
      <TabBar variant="two" :active="-1" />
      <SafeArea />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.pl-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  background-color: $color-cream;
}

/* ---------------- ① 筛选区域（pt16 px16 gap12） ---------------- */
.pl-head {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: $space-12;
  padding: $space-16 $space-16 0;
}

.pl-search-wrap {
  position: relative;
}

.pl-search-row {
  display: flex;
  align-items: center;
  gap: $space-10;
}

.pl-search-box {
  position: relative;
  flex: 1;
  height: 36px;
  border-radius: $radius-18;
  background-color: $color-fill;
}

/* 搜索图标 16×16，left14 top10 */
.pl-search-icon {
  position: absolute;
  top: $space-10;
  left: 14px;
  width: 16px;
  height: 16px;
}

/* 占位/输入文字 left38 top9，行高 19（高 36 内垂直居中） */
.pl-search-input {
  width: 100%;
  height: 36px;
  padding-left: $space-32 + $space-6; /* 38：图标 16 + left14 + 间距 8 */
  padding-right: $space-32;
  box-sizing: border-box;
  font-family: $font-family-cn;
  font-size: $font-13;
  font-weight: $font-weight-regular;
  line-height: $line-height-13-fixed;
  color: $color-text-1;
}

.pl-search-clear {
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

.pl-search-clear-icon {
  font-size: $font-12;
  line-height: 1;
  color: $color-text-3;
}

/* 右侧 list 图标 22×22（Q6：可点，仍网格） */
.pl-view-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 36px;
}

.pl-history {
  position: absolute;
  top: calc(100% + #{$space-8});
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: $space-12;
  padding: $space-12;
  border-radius: $radius-12;
  background-color: $color-text-inv;
  box-shadow: $shadow-card;
}

.pl-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pl-history-title {
  font-family: $font-family-cn;
  font-size: $font-12;
  color: $color-text-3;
}

.pl-history-clear {
  font-family: $font-family-cn;
  font-size: $font-12;
  color: $color-navy;
}

.pl-history-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $space-8;
}

.pl-history-chip {
  padding: $space-5 $space-12;
  border-radius: $radius-pill;
  background-color: $color-fill;
}

.pl-history-chip-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  color: $color-text-1;
}

/* 排序行 h38 gap34；选中项文字 + 下方 28×3 指示条 gap7 */
.pl-sort-row {
  display: flex;
  align-items: center;
  gap: $space-34;
  height: 38px;
}

.pl-sort-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-7;
}

.pl-sort-tab-text {
  font-family: $font-family-cn;
  font-size: $font-14;
  font-weight: $font-weight-regular;
  line-height: 1;
  color: $color-text-2;
}

.pl-sort-tab--active .pl-sort-tab-text {
  font-weight: $font-weight-bold;
  color: $color-navy;
}

.pl-sort-indicator {
  width: 28px;
  height: 3px;
  border-radius: $radius-2;
  background-color: $color-yellow;
}

/* ---------------- ② 产品网格（bg fill p16 row-gap12 col-gap9） ---------------- */
.pl-main {
  flex: 1;
  height: 0;
  background-color: $color-fill;
}

.pl-grid {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  row-gap: $space-12;
  column-gap: $space-9;
  padding: $space-16;
  box-sizing: border-box;
}

/* 卡宽 = (容器 343 - 列间距 9) / 2 = 167（随屏宽自适应，不写死） */
.pl-card {
  width: calc((100% - #{$space-9}) / 2);
}

.pl-footer {
  width: 100%;
  padding: $space-12 0 $space-8;
  text-align: center;
}

.pl-footer-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  color: $color-text-3;
}

/* ---------------- 状态（加载/错误/空） ---------------- */
.pl-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $space-12;
  padding: $space-60 $space-16;
}

.pl-state-text {
  font-family: $font-family-cn;
  font-size: $font-13;
  color: $color-text-3;
  text-align: center;
}

.pl-state-retry {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 21px;
  padding: 0 $space-16;
  border-radius: $radius-pill;
  background-color: $color-yellow;
}

.pl-state-retry-text {
  font-family: $font-family-cn;
  font-size: $font-12;
  font-weight: $font-weight-semibold;
  color: $color-navy;
}

/* ---------------- ③ 底部 TabBar two + 安全区 ---------------- */
.pl-tabbar {
  flex-shrink: 0;
  background-color: $color-text-inv;
}
</style>
