<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>轮播图管理</span>
          <el-button type="primary" @click="openCreate">新建轮播图</el-button>
        </div>
      </template>

      <el-table v-loading="loading" :data="banners" border stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="图片" width="160">
          <template #default="{ row }">
            <el-image
              :src="row.image"
              :preview-src-list="[row.image]"
              preview-teleported
              fit="cover"
              class="banner-thumb"
            />
          </template>
        </el-table-column>
        <el-table-column label="跳转类型" width="110">
          <template #default="{ row }">
            <el-tag :type="jumpTypeTag(row.jump_type)">
              {{ jumpTypeLabel(row.jump_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="跳转值" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ jumpValueText(row) }}</template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90">
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
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId === null ? '新建轮播图' : `编辑轮播图 #${editingId}`"
      width="560px"
      destroy-on-close
      @closed="onDialogClosed"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="图片" prop="image">
          <ImageUpload v-model="form.image" />
        </el-form-item>
        <el-form-item label="跳转类型" prop="jump_type">
          <el-select v-model="form.jump_type" style="width: 100%" @change="onJumpTypeChange">
            <el-option
              v-for="opt in JUMP_TYPE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.jump_type === 2" label="跳转分类" prop="categoryValue">
          <el-select v-model="form.categoryValue" placeholder="选择分类" style="width: 100%">
            <el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.jump_type === 3" label="跳转产品" prop="productValue">
          <el-select
            v-model="form.productValue"
            filterable
            remote
            reserve-keyword
            placeholder="输入产品名称搜索"
            :remote-method="searchProducts"
            :loading="productSearching"
            style="width: 100%"
          >
            <el-option
              v-for="p in productOptions"
              :key="p.id"
              :label="`${p.name}（${p.model}）`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.jump_type === 4" label="外链地址" prop="externalUrl">
          <el-input v-model="form.externalUrl" placeholder="https://..." maxlength="255" />
        </el-form-item>
        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="form.sort" :min="0" :max="9999" />
          <span class="form-tip">数字越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
          <span class="form-tip">{{ form.status === 1 ? '启用' : '禁用' }}</span>
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
  createBanner,
  deleteBanner,
  listBanners,
  listCategories,
  listProducts,
  toggleBannerStatus,
  updateBanner,
} from '@/api/content'
import ImageUpload from '@/components/ImageUpload.vue'
import type { Banner, BannerCreate, BannerJumpType, Category } from '@/types/content'
import { formatDateTime } from '@/utils/format'

/**
 * 轮播图管理（BE-08）：列表 + 新建/编辑对话框 + 状态开关 + 软删除（status=0）。
 * jump_type 语义与后端 _validate_jump_target 对齐：1 无 / 2 分类ID / 3 产品ID / 4 http(s) 外链；
 * 切换到「无跳转」时后端自行清空 jump_value（admin_content_service.update_banner）。
 */

const JUMP_TYPE_OPTIONS: { value: BannerJumpType; label: string }[] = [
  { value: 1, label: '无跳转' },
  { value: 2, label: '产品分类' },
  { value: 3, label: '产品详情' },
  { value: 4, label: '外部链接' },
]

interface ProductOption {
  id: number
  name: string
  model: string
}

interface BannerFormState {
  image: string | null
  jump_type: BannerJumpType
  /** jump_type=2 时的分类 ID（提交时转字符串存 jump_value） */
  categoryValue: number | null
  /** jump_type=3 时的产品 ID（提交时转字符串存 jump_value） */
  productValue: number | null
  /** jump_type=4 时的外链 URL */
  externalUrl: string
  sort: number
  status: number
}

function emptyForm(): BannerFormState {
  return {
    image: null,
    jump_type: 1,
    categoryValue: null,
    productValue: null,
    externalUrl: '',
    sort: 0,
    status: 1,
  }
}

const loading = ref(false)
const saving = ref(false)
const banners = ref<Banner[]>([])
const categories = ref<Category[]>([])
const productOptions = ref<ProductOption[]>([])
const productSearching = ref(false)
/** 已知产品名缓存（列表「跳转值」展示用，避免逐行回查） */
const productNameCache = reactive(new Map<number, string>())

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<BannerFormState>(emptyForm())

function jumpTypeLabel(type: BannerJumpType): string {
  return JUMP_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? `未知(${type})`
}

function jumpTypeTag(type: BannerJumpType): 'info' | 'success' | 'warning' | 'primary' {
  const map: Record<BannerJumpType, 'info' | 'success' | 'warning' | 'primary'> = {
    1: 'info',
    2: 'success',
    3: 'warning',
    4: 'primary',
  }
  return map[type] ?? 'info'
}

function jumpValueText(row: Banner): string {
  if (row.jump_type === 1 || !row.jump_value) return '-'
  if (row.jump_type === 2) {
    const id = Number(row.jump_value)
    return categories.value.find((c) => c.id === id)?.name ?? `分类 #${row.jump_value}`
  }
  if (row.jump_type === 3) {
    return productNameCache.get(Number(row.jump_value)) ?? `产品 #${row.jump_value}`
  }
  return row.jump_value
}

const rules: FormRules = {
  image: [{ required: true, message: '请上传轮播图片', trigger: 'change' }],
  jump_type: [{ required: true, message: '请选择跳转类型', trigger: 'change' }],
  categoryValue: [{ required: true, message: '请选择跳转分类', trigger: 'change' }],
  productValue: [{ required: true, message: '请选择跳转产品', trigger: 'change' }],
  externalUrl: [
    { required: true, message: '请输入外链地址', trigger: 'blur' },
    {
      pattern: /^https?:\/\/.+/,
      message: '外链必须以 http:// 或 https:// 开头',
      trigger: 'blur',
    },
  ],
}

async function fetchBanners(): Promise<void> {
  loading.value = true
  try {
    banners.value = await listBanners()
  } finally {
    loading.value = false
  }
}

async function fetchCategories(): Promise<void> {
  categories.value = await listCategories()
}

async function searchProducts(keyword: string): Promise<void> {
  productSearching.value = true
  try {
    const page = await listProducts({ page: 1, size: 20, name: keyword || null })
    productOptions.value = page.items.map((p) => ({ id: p.id, name: p.name, model: p.model }))
    for (const p of page.items) productNameCache.set(p.id, p.name)
  } finally {
    productSearching.value = false
  }
}

function resetForm(): void {
  Object.assign(form, emptyForm())
  editingId.value = null
  productOptions.value = []
}

function openCreate(): void {
  resetForm()
  dialogVisible.value = true
}

async function openEdit(row: Banner): Promise<void> {
  resetForm()
  editingId.value = row.id
  form.image = row.image
  form.jump_type = row.jump_type
  form.sort = row.sort
  form.status = row.status
  if (row.jump_value) {
    if (row.jump_type === 2) {
      form.categoryValue = Number(row.jump_value)
    } else if (row.jump_type === 3) {
      const productId = Number(row.jump_value)
      form.productValue = productId
      if (!productNameCache.has(productId)) {
        // 预载当前跳转产品，保证下拉能回显名称
        await searchProducts('')
      }
      productOptions.value = productOptions.value.some((p) => p.id === productId)
        ? productOptions.value
        : [
            {
              id: productId,
              name: productNameCache.get(productId) ?? `产品 #${productId}`,
              model: '',
            },
            ...productOptions.value,
          ]
    } else if (row.jump_type === 4) {
      form.externalUrl = row.jump_value
    }
  }
  dialogVisible.value = true
}

function onDialogClosed(): void {
  formRef.value?.clearValidate()
  resetForm()
}

function onJumpTypeChange(): void {
  // 切换类型时清掉其他类型的输入，避免脏值被提交
  form.categoryValue = null
  form.productValue = null
  form.externalUrl = ''
  if (form.jump_type === 3 && productOptions.value.length === 0) {
    void searchProducts('')
  }
}

function buildPayload(): BannerCreate {
  let jumpValue: string | null = null
  if (form.jump_type === 2 && form.categoryValue !== null) {
    jumpValue = String(form.categoryValue)
  } else if (form.jump_type === 3 && form.productValue !== null) {
    jumpValue = String(form.productValue)
  } else if (form.jump_type === 4) {
    jumpValue = form.externalUrl.trim()
  }
  return {
    image: form.image ?? '',
    jump_type: form.jump_type,
    jump_value: jumpValue,
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
      await createBanner(payload)
      ElMessage.success('新建成功')
    } else {
      await updateBanner(editingId.value, payload)
      ElMessage.success('保存成功')
    }
    dialogVisible.value = false
    await fetchBanners()
  } catch {
    // 错误 toast 已由 axios 拦截器统一处理
  } finally {
    saving.value = false
  }
}

/** el-switch before-change：请求成功才翻转开关 */
async function toggleStatus(row: Banner): Promise<boolean> {
  const next: 0 | 1 = row.status === 1 ? 0 : 1
  try {
    await toggleBannerStatus(row.id, next)
    row.status = next
    ElMessage.success(next === 1 ? '已启用' : '已禁用')
    return true
  } catch {
    return false
  }
}

async function onDelete(row: Banner): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认删除轮播图 #${row.id}？（软删除：置为禁用，小程序端不再展示）`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await deleteBanner(row.id)
  ElMessage.success('已删除（禁用）')
  await fetchBanners()
}

onMounted(async () => {
  await Promise.all([fetchBanners(), fetchCategories()])
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.banner-thumb {
  width: 120px;
  height: 56px;
  border-radius: 4px;
}

.form-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
