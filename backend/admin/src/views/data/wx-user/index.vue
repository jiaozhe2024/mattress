<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>小程序用户</span>
          <div class="header-tip">
            用户由微信授权登录自动创建，不支持手动新建
          </div>
        </div>
      </template>

      <!-- 筛选：昵称/OpenID 关键词 + 状态 -->
      <el-form :model="query" inline class="filter-bar" @submit.prevent>
        <el-form-item label="关键词">
          <el-input
            v-model="query.keyword"
            placeholder="昵称 / OpenID"
            clearable
            maxlength="64"
            style="width: 220px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="items" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="头像" width="80">
          <template #default="{ row }">
            <el-avatar v-if="row.avatar" :src="row.avatar" :size="32" />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="昵称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.nickname || '(未授权昵称)' }}</template>
        </el-table-column>
        <el-table-column label="OpenID" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-text size="small" type="info">{{ row.openid }}</el-text>
          </template>
        </el-table-column>
        <el-table-column label="方案数" width="100" align="center">
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click="openUserSchemes(row)">
              {{ row.scheme_count }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              :before-change="() => toggleStatus(row)"
            />
            <div class="status-hint">{{ row.status === 1 ? '启用' : '禁用' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="170">
          <template #default="{ row }">{{ formatDateTime(row.last_login_at) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @change="fetchUsers"
      />
    </el-card>

    <!-- 该用户的方案列表 -->
    <el-drawer v-model="drawerVisible" :title="drawerTitle" size="720px">
      <el-table v-loading="schemeLoading" :data="userSchemes" border stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="方案标题" min-width="160" show-overflow-tooltip />
        <el-table-column prop="product_count" label="产品数" width="90" align="center" />
        <el-table-column prop="share_count" label="分享数" width="90" align="center" />
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!schemeLoading && userSchemes.length === 0" description="该用户暂无方案" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { listUserSchemes, listWxUsers, setWxUserStatus } from '@/api/system'
import type { AdminSchemeItem, WxUserItem, WxUserQuery } from '@/types/system'
import { formatDateTime } from '@/utils/format'

/**
 * 小程序用户管理（BE-09）。
 *
 * 只读 + 启停：用户由微信授权登录自动创建（PRD 明确不支持手动建用户）。
 * 禁用（status=0）后该用户 wxapi 登录与 refresh 均被后端拒 403。
 * 点「方案数」抽屉展示该用户方案（等价于「点用户跳转其方案列表」）。
 */

function emptyQuery(): WxUserQuery {
  return { page: 1, size: 20, keyword: '', status: null }
}

const loading = ref(false)
const query = reactive<WxUserQuery>(emptyQuery())
const items = ref<WxUserItem[]>([])
const total = ref(0)

// 抽屉：某用户的方案
const drawerVisible = ref(false)
const drawerTitle = ref('')
const schemeLoading = ref(false)
const userSchemes = ref<AdminSchemeItem[]>([])

async function fetchUsers(): Promise<void> {
  loading.value = true
  try {
    const page = await listWxUsers({
      page: query.page,
      size: query.size,
      keyword: query.keyword || undefined,
      status: query.status ?? undefined,
    })
    items.value = page.items
    total.value = page.total
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void fetchUsers()
}

function onReset(): void {
  Object.assign(query, emptyQuery())
  void fetchUsers()
}

/** 启停前置确认 + 调用；返回 false 阻止开关翻转（成功后由接口返回值校正）。 */
async function toggleStatus(row: WxUserItem): Promise<boolean> {
  const next = row.status === 1 ? 0 : 1
  const action = next === 1 ? '启用' : '禁用'
  try {
    await ElMessageBox.confirm(
      next === 0
        ? `禁用后该用户将无法登录小程序（已保存的方案仍保留）。确认禁用「${row.nickname || row.openid}」？`
        : `确认启用「${row.nickname || row.openid}」？`,
      `${action}确认`,
      { type: 'warning' },
    )
  } catch {
    return false
  }
  try {
    const updated = await setWxUserStatus(row.id, next as 0 | 1)
    Object.assign(row, updated)
    ElMessage.success(`已${action}`)
  } catch {
    // 错误 toast 由 axios 拦截器统一处理
  }
  return false
}

async function openUserSchemes(row: WxUserItem): Promise<void> {
  drawerTitle.value = `${row.nickname || row.openid} 的方案（${row.scheme_count}）`
  drawerVisible.value = true
  schemeLoading.value = true
  try {
    const page = await listUserSchemes(row.id, { page: 1, size: 50 })
    userSchemes.value = page.items
  } catch {
    userSchemes.value = []
  } finally {
    schemeLoading.value = false
  }
}

onMounted(() => {
  void fetchUsers()
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

.status-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
