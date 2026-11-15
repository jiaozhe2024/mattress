<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>方案数据</span>
          <div class="header-tip">含已删除方案（管理员可追溯）；删除为软删除</div>
        </div>
      </template>

      <!-- 筛选：标题 / 用户ID / 创建时间区间 -->
      <el-form :model="query" inline class="filter-bar" @submit.prevent>
        <el-form-item label="标题">
          <el-input
            v-model="query.keyword"
            placeholder="方案标题 LIKE"
            clearable
            maxlength="100"
            style="width: 200px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="用户ID">
          <el-input
            v-model.number="query.user_id"
            placeholder="wx_user.id"
            clearable
            style="width: 140px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="创建时间">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            start-placeholder="开始"
            end-placeholder="结束"
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 380px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="items" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="方案标题" min-width="180" show-overflow-tooltip />
        <el-table-column label="创建者" min-width="170" show-overflow-tooltip>
          <template #default="{ row }">
            <div>{{ row.user_nickname || '(未授权昵称)' }}</div>
            <el-text size="small" type="info">{{ row.user_openid }}</el-text>
          </template>
        </el-table-column>
        <el-table-column prop="product_count" label="产品数" width="90" align="center" />
        <el-table-column prop="share_count" label="分享数" width="90" align="center" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="isDeleted(row) ? 'info' : 'success'" size="small">
              {{ isDeleted(row) ? '已删除' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="!isDeleted(row)"
              link
              type="danger"
              @click="onDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @change="fetchSchemes"
      />
    </el-card>

    <!-- 方案详情：快照产品只读展示 -->
    <el-drawer v-model="detailVisible" title="方案详情" size="760px">
      <div v-loading="detailLoading">
        <el-descriptions v-if="detail" :column="2" border>
          <el-descriptions-item label="方案 ID">{{ detail.id }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
          <el-descriptions-item label="创建者">
            {{ detail.user_nickname || '(未授权昵称)' }}
          </el-descriptions-item>
          <el-descriptions-item label="OpenID">{{ detail.user_openid }}</el-descriptions-item>
          <el-descriptions-item label="产品数">{{ detail.product_count }}</el-descriptions-item>
          <el-descriptions-item label="分享数">{{ detail.share_count }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(detail.create_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDateTime(detail.update_time) }}
          </el-descriptions-item>
          <el-descriptions-item label="详细说明" :span="2">
            {{ detail.remark || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          type="info"
          :closable="false"
          class="snapshot-tip"
          title="以下产品信息为方案创建时的快照，不随产品库变更（核心约定 10）"
        />

        <el-table :data="detail?.products ?? []" border stripe>
          <el-table-column label="图" width="90">
            <template #default="{ row }">
              <el-image
                v-if="row.main_image"
                :src="row.main_image"
                :preview-src-list="[row.main_image]"
                preview-teleported
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 4px"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="sort" label="序" width="60" align="center" />
          <el-table-column prop="name" label="产品名称（快照）" min-width="160" show-overflow-tooltip />
          <el-table-column label="卖点（快照）" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ row.slogan || '-' }}</template>
          </el-table-column>
          <el-table-column label="规格（快照）" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.spec || '-' }}</template>
          </el-table-column>
        </el-table>
        <el-empty
          v-if="detail && detail.products.length === 0"
          description="该方案没有产品快照"
        />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { deleteScheme, getScheme, listSchemes } from '@/api/system'
import type {
  AdminSchemeDetail,
  AdminSchemeItem,
  AdminSchemeQuery,
} from '@/types/system'
import { formatDateTime } from '@/utils/format'

/**
 * 方案数据管理（BE-09）。
 *
 * 管理员视图特性：
 * - 列表含已软删除方案（后端 include_deleted=True），用「状态」tag 区分
 * - 详情产品行来自 product_snapshot，页面上不做任何实时产品回查
 * - 删除为软删除：删除后 wxapi 列表不可见、public 接口 404
 */

function emptyQuery(): AdminSchemeQuery {
  return { page: 1, size: 20, keyword: '', user_id: null }
}

const loading = ref(false)
const query = reactive<AdminSchemeQuery>(emptyQuery())
const dateRange = ref<[string, string] | null>(null)
const items = ref<AdminSchemeItem[]>([])
const total = ref(0)

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AdminSchemeDetail | null>(null)

/** 是否已软删除（后端 AdminSchemeItem.deleted_at 非空即已删）。 */
function isDeleted(row: AdminSchemeItem): boolean {
  return row.deleted_at !== null && row.deleted_at !== undefined
}

async function fetchSchemes(): Promise<void> {
  loading.value = true
  try {
    const page = await listSchemes({
      page: query.page,
      size: query.size,
      keyword: query.keyword || undefined,
      user_id: query.user_id ?? undefined,
      start_time: dateRange.value?.[0] || undefined,
      end_time: dateRange.value?.[1] || undefined,
    })
    items.value = page.items
    total.value = page.total
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void fetchSchemes()
}

function onReset(): void {
  Object.assign(query, emptyQuery())
  dateRange.value = null
  void fetchSchemes()
}

async function openDetail(row: AdminSchemeItem): Promise<void> {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getScheme(row.id)
  } catch {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

async function onDelete(row: AdminSchemeItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除后该方案在小程序端不可见、分享链接失效。确认删除「${row.title}」？`,
      '删除确认',
      { type: 'warning', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  try {
    await deleteScheme(row.id)
    ElMessage.success('已删除')
    await fetchSchemes()
  } catch {
    // 错误 toast 由 axios 拦截器统一处理
  }
}

onMounted(() => {
  void fetchSchemes()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.filter-bar {
  margin-bottom: 12px;
}

.snapshot-tip {
  margin: 16px 0 12px;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
