<template>
  <div>
    <el-card v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>品牌信息配置</span>
          <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
        </div>
      </template>

      <el-alert
        v-if="!exists"
        title="尚未保存过品牌信息，首次保存后小程序端「我的」页将展示以下内容。"
        type="info"
        :closable="false"
        class="first-save-tip"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="brand-form">
        <el-form-item label="品牌介绍" prop="intro">
          <el-input
            v-model="form.intro"
            type="textarea"
            :rows="6"
            maxlength="5000"
            show-word-limit
            placeholder="成立时间 / 总部 / 规模 / 门店数 / 品牌定位文案…"
          />
        </el-form-item>

        <el-form-item label="加盟电话" prop="join_phone">
          <el-input
            v-model="form.join_phone"
            maxlength="20"
            placeholder="6-20 位纯数字，小程序「加入我们」拨号用"
            style="width: 320px"
          />
        </el-form-item>

        <el-form-item label="客服承诺">
          <div class="promise-list">
            <div v-for="(_item, index) in form.service_promise" :key="index" class="promise-row">
              <el-input
                v-model="form.service_promise[index]"
                maxlength="100"
                placeholder="如：7 天无理由退换"
                style="width: 420px"
              />
              <el-button link type="danger" @click="removePromise(index)">删除</el-button>
            </div>
            <el-button
              :disabled="form.service_promise.length >= 20"
              @click="addPromise"
            >
              + 添加承诺（{{ form.service_promise.length }}/20）
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="门店图" prop="store_images">
          <MultiImageUpload v-model="form.store_images" :limit="20" tip="最多 20 张" />
        </el-form-item>

        <el-form-item v-if="lastUpdateTime" label="最近更新">
          <span class="form-tip">{{ formatDateTime(lastUpdateTime) }}</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'

import { getBrandInfo, updateBrandInfo } from '@/api/content'
import MultiImageUpload from '@/components/MultiImageUpload.vue'
import type { BrandInfoUpdate } from '@/types/content'
import { formatDateTime } from '@/utils/format'

/**
 * 品牌信息配置（BE-08）：gin_brand_info 单行 upsert。
 * GET /admin/brand 缺失时 data=null（首次保存创建）；
 * join_phone 后端校验 6-20 位纯数字；service_promise ≤20 条非空字符串。
 */

interface BrandFormState {
  intro: string
  join_phone: string
  service_promise: string[]
  store_images: string[]
}

function emptyForm(): BrandFormState {
  return { intro: '', join_phone: '', service_promise: [], store_images: [] }
}

const loading = ref(false)
const saving = ref(false)
const exists = ref(false)
const lastUpdateTime = ref<string | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<BrandFormState>(emptyForm())

const rules: FormRules = {
  join_phone: [
    {
      validator: (_rule, value: string, callback) => {
        if (value === '' || /^\d{6,20}$/.test(value)) {
          callback()
        } else {
          callback(new Error('加盟电话必须为 6-20 位纯数字'))
        }
      },
      trigger: 'blur',
    },
  ],
}

async function fetchBrand(): Promise<void> {
  loading.value = true
  try {
    const data = await getBrandInfo()
    if (data === null) {
      exists.value = false
      Object.assign(form, emptyForm())
      return
    }
    exists.value = true
    lastUpdateTime.value = data.update_time
    Object.assign(form, {
      intro: data.intro ?? '',
      join_phone: data.join_phone ?? '',
      service_promise: (data.service_promise ?? []).map(String),
      store_images: (data.store_images ?? []).map(String),
    })
  } finally {
    loading.value = false
  }
}

function addPromise(): void {
  if (form.service_promise.length >= 20) return
  // 追加新条目（替换数组，保持响应式且不改原引用语义）
  form.service_promise = [...form.service_promise, '']
}

function removePromise(index: number): void {
  form.service_promise = form.service_promise.filter((_, i) => i !== index)
}

function nullIfEmpty(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function buildPayload(): BrandInfoUpdate {
  return {
    intro: nullIfEmpty(form.intro),
    join_phone: nullIfEmpty(form.join_phone),
    // 过滤空白条目，与后端「非空字符串数组」校验对齐
    service_promise: form.service_promise.map((s) => s.trim()).filter((s) => s !== ''),
    store_images: form.store_images,
  }
}

async function onSave(): Promise<void> {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const saved = await updateBrandInfo(buildPayload())
    exists.value = true
    lastUpdateTime.value = saved.update_time
    ElMessage.success('品牌信息已保存')
    await fetchBrand()
  } catch {
    // 错误 toast 已由 axios 拦截器统一处理（如电话格式 422）
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await fetchBrand()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.first-save-tip {
  margin-bottom: 16px;
}

.brand-form {
  max-width: 760px;
}

.promise-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.promise-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
}
</style>
