<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>产品分类管理</span>
          <el-button type="primary" @click="openCreate">新建分类</el-button>
        </div>
      </template>

      <el-alert
        title="8 大预置分类只允许禁用，不允许删除；已有产品的分类同样不可删除（后端 400 拒绝）。"
        type="info"
        :closable="false"
        class="preset-alert"
      />

      <el-table v-loading="loading" :data="categories" border stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="入口图" width="110">
          <template #default="{ row }">
            <el-image
              v-if="row.banner_image"
              :src="row.banner_image"
              :preview-src-list="[row.banner_image]"
              preview-teleported
              fit="cover"
              class="category-banner"
            />
            <span v-else class="form-tip">未上传</span>
          </template>
        </el-table-column>
        <el-table-column label="图标" width="90">
          <template #default="{ row }">
            <el-image
              v-if="row.icon"
              :src="row.icon"
              :preview-src-list="[row.icon]"
              preview-teleported
              fit="contain"
              class="category-icon"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="140">
          <template #default="{ row }">
            {{ row.name }}
            <el-tag v-if="row.is_preset" size="small" type="warning" class="preset-tag">
              预置
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="副文案" min-width="150">
          <template #default="{ row }">
            <span v-if="row.subtitle">{{ row.subtitle }}</span>
            <span v-else class="form-tip">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="product_count" label="产品数" width="90" />
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
            <el-tooltip
              :disabled="!row.is_preset"
              content="预置分类不可删除，请使用状态开关禁用"
              placement="top"
            >
              <!-- 预置分类禁用删除入口（后端 Service 同样 400 兜底） -->
              <span>
                <el-button link type="danger" :disabled="row.is_preset" @click="onDelete(row)">
                  删除
                </el-button>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId === null ? '新建分类' : `编辑分类 #${editingId}`"
      width="480px"
      destroy-on-close
      @closed="onDialogClosed"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" maxlength="50" show-word-limit placeholder="分类名称" />
        </el-form-item>
        <el-form-item label="副文案" prop="subtitle">
          <el-input
            v-model="form.subtitle"
            maxlength="100"
            show-word-limit
            placeholder="如：六大专属　分龄深睡"
          />
          <span class="form-tip">两段文案建议用全角空格分隔</span>
        </el-form-item>
        <el-form-item label="图标" prop="icon">
          <ImageUpload v-model="form.icon" />
        </el-form-item>
        <el-form-item label="入口图" prop="banner_image">
          <ImageUpload v-model="form.bannerImage" />
          <span class="form-tip">整块入口图片；上传后小程序优先显示图片</span>
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
  createCategory,
  deleteCategory,
  listCategories,
  toggleCategoryStatus,
  updateCategory,
} from '@/api/content'
import ImageUpload from '@/components/ImageUpload.vue'
import type { Category, CategoryCreate } from '@/types/content'
import { formatDateTime } from '@/utils/format'

/**
 * 产品分类管理（BE-08）：列表 + 新建/编辑对话框 + 状态开关 + 删除。
 * 预置分类（is_preset=true）删除按钮禁用，只保留状态开关（禁用替代删除）；
 * 非预置但已有产品的分类后端同样 400 拒绝删除（Service 层兜底）。
 */

interface CategoryFormState {
  name: string
  subtitle: string | null
  icon: string | null
  bannerImage: string | null
  sort: number
  status: number
}

function emptyForm(): CategoryFormState {
  return { name: '', subtitle: null, icon: null, bannerImage: null, sort: 0, status: 1 }
}

const loading = ref(false)
const saving = ref(false)
const categories = ref<Category[]>([])

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<CategoryFormState>(emptyForm())

const rules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { max: 50, message: '名称最长 50 字符', trigger: 'blur' },
  ],
  subtitle: [{ max: 100, message: '副文案最长 100 字符', trigger: 'blur' }],
}

async function fetchCategories(): Promise<void> {
  loading.value = true
  try {
    categories.value = await listCategories()
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  Object.assign(form, emptyForm())
  editingId.value = null
  dialogVisible.value = true
}

function openEdit(row: Category): void {
  editingId.value = row.id
  form.name = row.name
  form.subtitle = row.subtitle
  form.icon = row.icon
  form.bannerImage = row.banner_image
  form.sort = row.sort
  form.status = row.status
  dialogVisible.value = true
}

function onDialogClosed(): void {
  formRef.value?.clearValidate()
  Object.assign(form, emptyForm())
  editingId.value = null
}

async function onSubmit(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  const payload: CategoryCreate = {
    name: form.name.trim(),
    subtitle: form.subtitle?.trim() || null,
    icon: form.icon,
    banner_image: form.bannerImage,
    sort: form.sort,
    status: form.status,
  }
  saving.value = true
  try {
    if (editingId.value === null) {
      await createCategory(payload)
      ElMessage.success('新建成功')
    } else {
      await updateCategory(editingId.value, payload)
      ElMessage.success('保存成功')
    }
    dialogVisible.value = false
    await fetchCategories()
  } catch {
    // 错误 toast 已由 axios 拦截器统一处理
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row: Category): Promise<boolean> {
  const next: 0 | 1 = row.status === 1 ? 0 : 1
  try {
    await toggleCategoryStatus(row.id, next)
    row.status = next
    ElMessage.success(next === 1 ? '已启用' : '已禁用')
    return true
  } catch {
    return false
  }
}

async function onDelete(row: Category): Promise<void> {
  if (row.is_preset) return // 双保险：按钮已禁用
  try {
    await ElMessageBox.confirm(
      `确认删除分类「${row.name}」？（软删除：置为禁用）`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await deleteCategory(row.id)
  ElMessage.success('已删除（禁用）')
  await fetchCategories()
}

onMounted(fetchCategories)
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preset-alert {
  margin-bottom: 12px;
}

.category-icon {
  width: 44px;
  height: 44px;
}

.category-banner {
  width: 90px;
  height: 44px;
  border-radius: 4px;
}

.preset-tag {
  margin-left: 6px;
}

.form-tip {
  margin-left: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
