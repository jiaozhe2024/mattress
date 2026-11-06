<template>
  <div class="image-upload">
    <el-upload
      v-model:file-list="fileList"
      list-type="picture-card"
      accept="image/*"
      :limit="1"
      :http-request="doUpload"
      :on-success="onSuccess"
      :on-error="onError"
      :on-remove="emitValue"
      :on-preview="onPreview"
      :on-exceed="onExceed"
    >
      <el-icon><Plus /></el-icon>
    </el-upload>
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
import { ref, watch } from 'vue'

import { uploadImage } from '@/api/content'
import type { ImageUploadResult } from '@/types/content'

/**
 * 单图上传（BE-08）：走 POST /admin/upload/image（OSS 适配层本地 mock）。
 * v-model 绑定「后端返回的相对 URL 字符串」（如 /uploads/images/xxx.png）；
 * 本地开发经 vite /uploads 代理直连后端静态目录（见 vite.config.ts）。
 * 超出 1 张须先删除再上传（on-exceed 提示）。
 */
const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [string | null]
}>()

let uidSeed = -1

function toFileList(url: string | null | undefined): UploadUserFile[] {
  if (!url) return []
  return [
    {
      name: url.split('/').pop() || url,
      url,
      status: 'success',
      uid: uidSeed--,
    },
  ]
}

const fileList = ref<UploadUserFile[]>(toFileList(props.modelValue))

// 外部重置表单（如对话框关闭后清空）时同步内部列表；内部变更不重复回写
watch(
  () => props.modelValue,
  (value) => {
    const current = fileList.value.find((f) => f.status === 'success')?.url ?? null
    if ((value ?? null) !== current) {
      fileList.value = toFileList(value)
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
  ElMessage.warning('仅支持 1 张图片，请先删除现有图片再上传')
}

async function doUpload(options: UploadRequestOptions): Promise<ImageUploadResult> {
  return uploadImage(options.file)
}

function onSuccess(result: ImageUploadResult, file: UploadFile): void {
  // http-request 成功后把后端 URL 写回文件项，供预览/取值
  file.url = result.url
  emitValue()
}

function onError(): void {
  // HTTP 错误 toast 已由 axios 拦截器统一处理，这里只保证列表状态复位
  emitValue()
}

function emitValue(): void {
  const url = fileList.value.find((f) => f.status === 'success')?.url ?? null
  emit('update:modelValue', url)
}
</script>

<style scoped>
.preview-image {
  width: 100%;
}
</style>
