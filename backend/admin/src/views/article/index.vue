<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>资讯与服务管理</span>
          <el-button type="primary" @click="openCreate">新建文章</el-button>
        </div>
      </template>

      <!-- 筛选栏：分类 / 标题 / 状态 -->
      <el-form :model="query" inline class="filter-bar" @submit.prevent>
        <el-form-item label="分类">
          <el-select
            v-model="query.category"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option label="宝顿资讯" value="news" />
            <el-option label="服务板块" value="service" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input
            v-model="query.title"
            placeholder="标题 LIKE"
            clearable
            maxlength="50"
            style="width: 200px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px">
            <el-option label="发布" :value="1" />
            <el-option label="下线" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onResetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="items" border stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="封面" width="90">
          <template #default="{ row }">
            <el-image
              v-if="row.cover"
              :src="row.cover"
              :preview-src-list="[row.cover]"
              preview-teleported
              fit="cover"
              class="article-cover"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="分类" width="110">
          <template #default="{ row }">
            <el-tag :type="row.category === 'news' ? 'primary' : 'success'" size="small">
              {{ categoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布" width="80">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status"
              :active-value="1"
              :inactive-value="0"
              :before-change="() => toggleStatus(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
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
        @change="fetchArticles"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId === null ? '新建文章' : `编辑文章 #${editingId}`"
      width="820px"
      top="5vh"
      destroy-on-close
      @closed="onDialogClosed"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="分类" prop="category">
          <el-radio-group v-model="form.category">
            <el-radio value="news">宝顿资讯</el-radio>
            <el-radio value="service">服务板块</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="封面" prop="cover">
          <ImageUpload v-model="form.cover" />
        </el-form-item>
        <el-form-item label="正文" prop="content">
          <RichTextEditor v-model="form.content" placeholder="文章正文（支持插图）…" />
        </el-form-item>
        <el-form-item label="发布状态" prop="status">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
          <span class="form-tip">{{ form.status === 1 ? '发布' : '下线' }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import {
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  toggleArticleStatus,
  updateArticle,
} from '@/api/content'
import ImageUpload from '@/components/ImageUpload.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { Article, ArticleCategory, ArticleCreate, ArticleQuery } from '@/types/content'
import { formatDateTime } from '@/utils/format'

/**
 * 资讯与服务管理（BE-08）：gin_article 单表双分类（news 宝顿资讯 / service 服务板块）。
 * 删除为软删除（后端置 status=0 下线），列表含下线文章。
 */

interface ArticleFormState {
  title: string
  category: ArticleCategory
  cover: string | null
  content: string
  status: number
}

function emptyForm(): ArticleFormState {
  return { title: '', category: 'news', cover: null, content: '', status: 1 }
}

function emptyQuery(): ArticleQuery {
  return { page: 1, size: 20, category: null, title: null, status: null }
}

function categoryLabel(category: string): string {
  return category === 'news' ? '宝顿资讯' : '服务板块'
}

const loading = ref(false)
const saving = ref(false)
const items = ref<Article[]>([])
const total = ref(0)
const query = reactive<ArticleQuery>(emptyQuery())

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<ArticleFormState>(emptyForm())

const rules: FormRules = {
  title: [{ required: true, message: '请输入文章标题', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

async function fetchArticles(): Promise<void> {
  loading.value = true
  try {
    const page = await listArticles({
      page: query.page,
      size: query.size,
      category: query.category,
      title: query.title?.trim() || null,
      status: query.status,
    })
    items.value = page.items
    total.value = page.total
  } finally {
    loading.value = false
  }
}

function onSearch(): void {
  query.page = 1
  void fetchArticles()
}

function onResetFilters(): void {
  Object.assign(query, emptyQuery())
  void fetchArticles()
}

function openCreate(): void {
  Object.assign(form, emptyForm())
  editingId.value = null
  dialogVisible.value = true
}

async function openEdit(row: Article): Promise<void> {
  editingId.value = row.id
  // 列表不带富文本，编辑须走详情接口取 content
  const detail = await getArticle(row.id)
  Object.assign(form, {
    title: detail.title,
    category: detail.category,
    cover: detail.cover,
    content: detail.content ?? '',
    status: detail.status,
  })
  dialogVisible.value = true
}

function onDialogClosed(): void {
  formRef.value?.clearValidate()
  Object.assign(form, emptyForm())
  editingId.value = null
}

/** 空字符串统一转 null（后端可选字段语义） */
function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function buildPayload(): ArticleCreate {
  return {
    title: form.title.trim(),
    category: form.category,
    cover: form.cover,
    content: nullIfEmpty(form.content),
    status: form.status,
  }
}

async function onSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const payload = buildPayload()
    if (editingId.value === null) {
      await createArticle(payload)
      ElMessage.success('新建成功')
    } else {
      await updateArticle(editingId.value, payload)
      ElMessage.success('保存成功')
    }
    dialogVisible.value = false
    await fetchArticles()
  } catch {
    // 错误 toast 已由 axios 拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row: Article): Promise<boolean> {
  const next: 0 | 1 = row.status === 1 ? 0 : 1
  try {
    await toggleArticleStatus(row.id, next)
    row.status = next
    ElMessage.success(next === 1 ? '已发布' : '已下线')
    return true
  } catch {
    return false
  }
}

async function onDelete(row: Article): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认删除文章「${row.title}」？删除即下线（软删除），小程序端不再展示。`,
      '删除确认',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await deleteArticle(row.id)
  ElMessage.success('已删除（下线）')
  await fetchArticles()
}

onMounted(async () => {
  await fetchArticles()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.filter-bar {
  margin-bottom: 4px;
}

.article-cover {
  width: 56px;
  height: 40px;
  border-radius: 4px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.form-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
