<template>
  <div class="rich-text-editor">
    <Toolbar
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
      class="editor-toolbar"
    />
    <Editor
      v-model="valueHtml"
      :default-config="editorConfig"
      mode="default"
      class="editor-body"
      @on-created="handleCreated"
    />
  </div>
</template>

<script setup lang="ts">
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import { uploadImage } from '@/api/content'

/**
 * wangEditor 富文本封装（BE-08）：产品详情 detail_content / 文章 content 共用。
 * - v-model 绑定 HTML 字符串
 * - 编辑器内插图走 POST /admin/upload/image（customUpload，与 ImageUpload 同一 OSS 适配层）
 * - 组件销毁时 editor.destroy()，防止对话框反复开关内存泄漏
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    placeholder?: string
    height?: string
  }>(),
  { modelValue: '', placeholder: '请输入内容…', height: '360px' },
)

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const editorRef = shallowRef<IDomEditor>()
const valueHtml = ref(props.modelValue ?? '')

function handleCreated(editor: IDomEditor): void {
  editorRef.value = editor
}

// 外部表单重置/回填详情时同步进编辑器（内容一致则不回写，避免光标跳动）
watch(
  () => props.modelValue,
  (value) => {
    const next = value ?? ''
    if (next !== valueHtml.value) {
      valueHtml.value = next
    }
  },
)

watch(valueHtml, (value) => {
  emit('update:modelValue', value)
})

const toolbarConfig: Partial<IToolbarConfig> = {
  // 视频与代码块超出内容管理场景，隐藏以收敛能力面
  excludeKeys: ['group-video', 'codeBlock', 'fullScreen'],
}

const editorConfig: Partial<IEditorConfig> = {
  placeholder: props.placeholder,
  MENU_CONF: {
    uploadImage: {
      async customUpload(
        file: File,
        insertFn: (url: string, alt?: string, href?: string) => void,
      ): Promise<void> {
        const result = await uploadImage(file)
        insertFn(result.url, result.url, result.url)
      },
    },
  },
}

onBeforeUnmount(() => {
  editorRef.value?.destroy()
})
</script>

<style scoped>
.rich-text-editor {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  /* 防止 wangEditor 下拉/弹层被 el-dialog 边界裁剪 */
  z-index: 10;
}

.editor-toolbar {
  border-bottom: 1px solid #dcdfe6;
}

.editor-body {
  height: v-bind(height);
  overflow-y: hidden;
}
</style>
