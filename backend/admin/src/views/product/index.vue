<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>产品管理</span>
          <div>
            <el-button
              :disabled="selection.length === 0"
              @click="onBatchStatus(1)"
            >
              批量上架
            </el-button>
            <el-button
              :disabled="selection.length === 0"
              @click="onBatchStatus(0)"
            >
              批量下架
            </el-button>
            <el-button type="primary" @click="openCreate">新建产品</el-button>
          </div>
        </div>
      </template>

      <!-- 筛选栏：分类 / 名称 / 型号 / 状态 -->
      <el-form :model="query" inline class="filter-bar" @submit.prevent>
        <el-form-item label="分类">
          <el-select
            v-model="query.category_id"
            placeholder="全部"
            clearable
            style="width: 160px"
          >
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input
            v-model="query.name"
            placeholder="产品名称 LIKE"
            clearable
            maxlength="50"
            style="width: 180px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="型号">
          <el-input
            v-model="query.model"
            placeholder="产品型号 LIKE"
            clearable
            maxlength="50"
            style="width: 160px"
            @keyup.enter="onSearch"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 110px">
            <el-option label="上架" :value="1" />
            <el-option label="下架" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">查询</el-button>
          <el-button @click="onResetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table
        v-loading="loading"
        :data="items"
        border
        stripe
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="主图" width="90">
          <template #default="{ row }">
            <el-image
              :src="row.main_image"
              :preview-src-list="[row.main_image]"
              preview-teleported
              fit="cover"
              class="product-thumb"
            />
          </template>
        </el-table-column>
        <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="model" label="型号" width="120" show-overflow-tooltip />
        <el-table-column label="分类" width="110">
          <template #default="{ row }">{{ row.category_name ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="spec" label="规格" width="100">
          <template #default="{ row }">{{ row.spec || '-' }}</template>
        </el-table-column>
        <el-table-column prop="sleep_feel" label="睡感" width="90">
          <template #default="{ row }">{{ row.sleep_feel || '-' }}</template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="70" />
        <el-table-column label="上架" width="80">
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
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
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
        @change="fetchProducts"
      />
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId === null ? '新建产品' : `编辑产品 #${editingId}`"
      width="880px"
      top="4vh"
      destroy-on-close
      @closed="onDialogClosed"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-divider content-position="left">基础信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="产品分类" prop="category_id">
              <el-select v-model="form.category_id" placeholder="选择分类" style="width: 100%">
                <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品名称" prop="name">
              <el-input v-model="form.name" maxlength="100" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="产品型号" prop="model">
              <el-input v-model="form.model" maxlength="50" placeholder="全库唯一" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="卖点标语" prop="slogan">
              <el-input v-model="form.slogan" maxlength="100" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规格" prop="spec">
              <el-input v-model="form.spec" maxlength="50" placeholder="如 1.8m×2.0m" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="睡感" prop="sleep_feel">
              <el-input v-model="form.sleep_feel" maxlength="20" placeholder="如 偏硬 / 适中 / 偏软" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sort">
              <el-input-number v-model="form.sort" :min="0" :max="9999" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="上架状态" prop="status">
              <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
              <span class="form-tip">{{ form.status === 1 ? '上架' : '下架' }}</span>
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">图片</el-divider>
        <el-form-item label="主图" prop="main_image">
          <ImageUpload v-model="form.main_image" />
        </el-form-item>
        <el-form-item label="详情轮播图" prop="detail_images">
          <MultiImageUpload v-model="form.detail_images" :limit="10" tip="最多 10 张" />
        </el-form-item>
        <el-form-item label="实拍图" prop="real_images">
          <MultiImageUpload v-model="form.real_images" :limit="20" tip="最多 20 张" />
        </el-form-item>

        <el-divider content-position="left">详情富文本</el-divider>
        <el-form-item label="详情内容" prop="detail_content" label-width="100px">
          <RichTextEditor v-model="form.detail_content" placeholder="产品详情（支持插图）…" />
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
  batchProductStatus,
  createProduct,
  getProduct,
  listCategories,
  listProducts,
  updateProduct,
} from '@/api/content'
import ImageUpload from '@/components/ImageUpload.vue'
import MultiImageUpload from '@/components/MultiImageUpload.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import type { Category, Product, ProductCreate, ProductQuery } from '@/types/content'
import { formatDateTime } from '@/utils/format'

/**
 * 产品管理（BE-08）：分页筛选列表 + 完整编辑表单 + 批量上下架。
 * 上下架即产品软删除语义（status=0 小程序端不可见，无物理删除）。
 * 图片上限与后端 Schema 一致：详情轮播图 ≤10、实拍图 ≤20；型号全库唯一（冲突后端 409）。
 */

interface ProductFormState {
  category_id: number | null
  name: string
  model: string
  slogan: string
  spec: string
  sleep_feel: string
  main_image: string | null
  detail_images: string[]
  real_images: string[]
  detail_content: string
  sort: number
  status: number
}

function emptyForm(): ProductFormState {
  return {
    category_id: null,
    name: '',
    model: '',
    slogan: '',
    spec: '',
    sleep_feel: '',
    main_image: null,
    detail_images: [],
    real_images: [],
    detail_content: '',
    sort: 0,
    status: 1,
  }
}

function emptyQuery(): ProductQuery {
  return { page: 1, size: 20, category_id: null, name: null, model: null, status: null }
}

const loading = ref(false)
const saving = ref(false)
const items = ref<Product[]>([])
const total = ref(0)
const categories = ref<Category[]>([])
const selection = ref<Product[]>([])
const query = reactive<ProductQuery>(emptyQuery())

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<ProductFormState>(emptyForm())

const rules: FormRules = {
  category_id: [{ required: true, message: '请选择产品分类', trigger: 'change' }],
  name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
  model: [{ required: true, message: '请输入产品型号（全库唯一）', trigger: 'blur' }],
  main_image: [{ required: true, message: '请上传产品主图', trigger: 'change' }],
}

async function fetchProducts(): Promise<void> {
  loading.value = true
  try {
    const page = await listProducts({
      page: query.page,
      size: query.size,
      category_id: query.category_id,
      name: query.name?.trim() || null,
      model: query.model?.trim() || null,
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
  void fetchProducts()
}

function onResetFilters(): void {
  Object.assign(query, emptyQuery())
  void fetchProducts()
}

function onSelectionChange(rows: Product[]): void {
  selection.value = rows
}

async function openCreate(): Promise<void> {
  Object.assign(form, emptyForm())
  editingId.value = null
  dialogVisible.value = true
}

async function openEdit(row: Product): Promise<void> {
  editingId.value = row.id
  // 列表行已含全字段，但为保证富文本完整（与详情接口一致）仍走 GET /admin/products/{id}
  const detail = await getProduct(row.id)
  Object.assign(form, {
    category_id: detail.category_id,
    name: detail.name,
    model: detail.model,
    slogan: detail.slogan ?? '',
    spec: detail.spec ?? '',
    sleep_feel: detail.sleep_feel ?? '',
    main_image: detail.main_image,
    detail_images: (detail.detail_images ?? []).map(String),
    real_images: (detail.real_images ?? []).map(String),
    detail_content: detail.detail_content ?? '',
    sort: detail.sort,
    status: detail.status,
  })
  dialogVisible.value = true
}

function onDialogClosed(): void {
  formRef.value?.clearValidate()
  Object.assign(form, emptyForm())
  editingId.value = null
}

/** 空字符串统一转 null（后端可选字段语义），避免存 ''脏值 */
function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function buildPayload(): ProductCreate {
  return {
    category_id: form.category_id as number, // rules 已保证非空
    name: form.name.trim(),
    model: form.model.trim(),
    slogan: nullIfEmpty(form.slogan),
    spec: nullIfEmpty(form.spec),
    sleep_feel: nullIfEmpty(form.sleep_feel),
    main_image: form.main_image ?? '',
    detail_images: form.detail_images,
    real_images: form.real_images,
    detail_content: nullIfEmpty(form.detail_content),
    sort: form.sort,
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
      await createProduct(payload)
      ElMessage.success('新建成功')
    } else {
      await updateProduct(editingId.value, payload)
      ElMessage.success('保存成功')
    }
    dialogVisible.value = false
    await fetchProducts()
  } catch {
    // 错误 toast 已由 axios 拦截器统一处理（如型号冲突 409）
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row: Product): Promise<boolean> {
  const next: 0 | 1 = row.status === 1 ? 0 : 1
  try {
    await updateProduct(row.id, { status: next })
    row.status = next
    ElMessage.success(next === 1 ? '已上架' : '已下架')
    return true
  } catch {
    return false
  }
}

async function onBatchStatus(status: 0 | 1): Promise<void> {
  const ids = selection.value.map((p) => p.id)
  if (ids.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确认将选中的 ${ids.length} 个产品${status === 1 ? '上架' : '下架'}？`,
      '批量操作确认',
      { type: 'warning' },
    )
  } catch {
    return
  }
  const result = await batchProductStatus(ids, status)
  ElMessage.success(`已${status === 1 ? '上架' : '下架'} ${result.updated} 个产品`)
  await fetchProducts()
}

onMounted(async () => {
  categories.value = await listCategories()
  await fetchProducts()
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

.product-thumb {
  width: 56px;
  height: 56px;
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
