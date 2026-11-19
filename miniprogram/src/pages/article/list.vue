<script setup lang="ts">
/** 资讯列表（MP-02 跳转目标：首页资讯入口 / 服务卡片同源内容）。 */
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getArticles, type ArticleCategory } from "@/api/content";
import type { WxArticleSummary } from "@/types/home";
import { absoluteUrl } from "@/utils/url";

const NAV_TITLE = "品牌资讯";

type PageStatus = "loading" | "ready" | "error";

const pageStatus = ref<PageStatus>("loading");
const articles = ref<WxArticleSummary[]>([]);
const category = ref<ArticleCategory>("news");

onLoad((options) => {
  category.value = options?.category === "service" ? "service" : "news";
  loadArticles();
});

async function loadArticles(): Promise<void> {
  pageStatus.value = "loading";
  try {
    const data = await getArticles({ category: category.value, page: 1, size: 20 });
    articles.value = data.items;
    pageStatus.value = "ready";
  } catch {
    articles.value = [];
    pageStatus.value = "error";
  }
}

function onArticleTap(article: WxArticleSummary): void {
  uni.navigateTo({ url: `/pages/article/detail?id=${article.id}` });
}

function formatDate(iso: string | null): string {
  if (iso === null) return "";
  return iso.slice(0, 10);
}
</script>

<template>
  <view class="page">
    <view class="body">
      <view v-if="pageStatus === 'loading'" class="state-box">
        <text class="state-text">加载中…</text>
      </view>
      <view v-else-if="pageStatus === 'error'" class="state-box">
        <text class="state-text">资讯加载失败</text>
        <view class="state-retry" @tap="loadArticles">
          <text class="state-retry-text">重试</text>
        </view>
      </view>
      <view v-else-if="articles.length === 0" class="state-box">
        <text class="state-text">暂无资讯</text>
      </view>
      <view v-else class="list">
        <view
          v-for="article in articles"
          :key="article.id"
          class="row"
          @tap="onArticleTap(article)"
        >
          <view class="row-cover">
            <text class="row-cover-fallback">讯</text>
            <image
              v-if="article.cover"
              class="row-cover-image"
              :src="absoluteUrl(article.cover)"
              mode="aspectFill"
              lazy-load
            />
          </view>
          <view class="row-body">
            <text class="row-title">{{ article.title }}</text>
            <text class="row-date">{{ formatDate(article.create_time) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  box-sizing: border-box;
  background-color: #fdfbf5;
}

.body {
  flex: 1;
  padding: 24rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 120rpx 32rpx;
}

.state-text {
  font-size: 26rpx;
  color: #8a90a3;
}

.state-retry {
  padding: 16rpx 64rpx;
  border-radius: 999rpx;
  background-color: #f7c400;
}

.state-retry-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a2260;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.row {
  display: flex;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background-color: #ffffff;
}

.row-cover {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 160rpx;
  height: 120rpx;
  border-radius: 16rpx;
  background-color: #e7eaf6;
  overflow: hidden;
}

.row-cover-fallback {
  font-size: 32rpx;
  font-weight: 600;
  color: #8890b8;
}

.row-cover-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.row-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
}

.row-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1e2330;
}

.row-date {
  font-size: 22rpx;
  color: #8a90a3;
}
</style>
