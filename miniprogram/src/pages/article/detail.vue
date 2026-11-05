<script setup lang="ts">
/** 资讯/服务详情（MP-02 跳转目标：首页服务卡片、资讯列表）。富文本走 rich-text。 */
import { onLoad } from "@dcloudio/uni-app";
import { ref } from "vue";
import { getArticle } from "@/api/content";
import type { WxArticleDetail } from "@/types/home";

type PageStatus = "loading" | "ready" | "error";

const pageStatus = ref<PageStatus>("loading");
const article = ref<WxArticleDetail | null>(null);
const articleId = ref(0);

onLoad((options) => {
  const id = Number(options?.id ?? "");
  if (!Number.isInteger(id) || id <= 0) {
    pageStatus.value = "error";
    return;
  }
  articleId.value = id;
  loadArticle();
});

async function loadArticle(): Promise<void> {
  pageStatus.value = "loading";
  try {
    article.value = await getArticle(articleId.value);
    pageStatus.value = "ready";
  } catch {
    article.value = null;
    pageStatus.value = "error";
  }
}

function formatDate(iso: string | null): string {
  if (iso === null) return "";
  return iso.slice(0, 10);
}
</script>

<template>
  <view class="page">
    <view v-if="pageStatus === 'loading'" class="state-box">
      <text class="state-text">加载中…</text>
    </view>
    <view v-else-if="pageStatus === 'error'" class="state-box">
      <text class="state-text">资讯不存在或已下线</text>
      <view class="state-retry" @tap="loadArticle">
        <text class="state-retry-text">重试</text>
      </view>
    </view>
    <view v-else-if="article" class="article">
      <text class="article-title">{{ article.title }}</text>
      <text class="article-date">{{ formatDate(article.create_time) }}</text>
      <rich-text v-if="article.content" class="article-content" :nodes="article.content" />
      <text v-else class="state-text">暂无正文</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx;
  box-sizing: border-box;
  background-color: #fdfbf5;
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

.article {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  background-color: #ffffff;
}

.article-title {
  font-size: 40rpx;
  font-weight: 600;
  color: #1e2330;
}

.article-date {
  font-size: 22rpx;
  color: #8a90a3;
}

.article-content {
  font-size: 28rpx;
  color: #4a5165;
}
</style>
