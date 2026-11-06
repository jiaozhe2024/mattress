<template>
  <div class="multi-image-upload">
    <el-upload
      v-model:file-list="fileList"
      list-type="picture-card"
      accept="image/*"
      multiple
      :limit="limit"
      :http-request="doUpload"
      :on-success="onSuccess"
      :on-error="onError"
      :on-remove="emitValue"
      :on-preview="onPreview"
      :on-exceed="onExceed"
    >
      <el-icon><Plus /></el-icon>
    </el-upload>
    <div v-if="tip" class="upload-tip">{{ tip }}</div>
    <el-dialog v-model="previewVisible" title="图片预览" append-to-body width="640px">
      <img v-if="previewUrl" :src="previewUrl" alt="预览" class="preview-image" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import {
  ElMessage,
  type UploadFile,
  type UploadRequestOptions,
  type UploadUserFile,
} from 'element-plus'
import { computed, ref, watch } from 'vue'

import { uploadImage } from '@/api/content'
import type { ImageUploadResult } from '@/types/content'

/**
 * 多图上传（BE-08）：逐张走 POST /admin/upload/image，v-model 绑定 URL 字符串数组。
 * 上限由 limit 控制（详情轮播图 ≤10 / 实拍图 ≤20 / 门店图 ≤20，与后端 Schema 校验一致），
 * 超限时 on-exceed 提示并拒绝（与后端 400 双保险）。
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string[] | null
    limit?: number
    tip?: string
  }>(),
  { modelValue: () => [], limit: 10, tip: '' },
)

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

let uidSeed = -1000

function toFileList(urls: readonly string[]): UploadUserFile[] {
  return urls.map((url) => ({
    name: url.split('/').pop() || url,
    url,
    status: 'success' as const,
    uid: uidSeed--,
  }))
}

const fileList = ref<UploadUserFile[]>(toFileList(props.modelValue ?? []))

const currentUrls = computed(() => successUrls(fileList.value))

function successUrls(files: readonly UploadUserFile[]): string[] {
  return files
    .filter((f) => f.status === 'success' && f.url)
    .map((f) => f.url as string)
}

// 外部重置表单时同步内部列表（值一致则不回写，避免死循环）
watch(
  () => props.modelValue,
  (value) => {
    const next = value ?? []
    if (next.join('|') !== currentUrls.value.join('|')) {
      fileList.value = toFileList(next)
    }
  },
)

const previewVisible = ref(false)
const previewUrl = ref('')

function onPreview(file: UploadFile): void {
  previewUrl.value = file.url ?? ''
  previewVisible.value = true
}

function onExceed(): void {
  ElMessage.warning(`最多上传 ${props.limit} 张图片`)
}

async function doUpload(options: UploadRequestOptions): Promise<ImageUploadResult> {
  return uploadImage(options.file)
}

function onSuccess(result: ImageUploadResult, file: UploadFile): void {
  file.url = result.url
  emitValue()
}

function onError(): void {
  // HTTP 错误 toast 已由 axios 拦截器统一处理
  emitValue()
}

function emitValue(): void {
  emit('update:modelValue', currentUrls.value)
}
</script>

<style scoped>
.upload-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.preview-image {
  width: 100%;
}
</style>
