<template>
  <div class="navbar">
    <el-breadcrumb separator="/">
      <el-breadcrumb-item v-for="(item, idx) in breadcrumbs" :key="idx">
        {{ item }}
      </el-breadcrumb-item>
    </el-breadcrumb>
    <el-dropdown @command="onCommand">
      <span class="user-trigger">
        <el-icon><UserFilled /></el-icon>
        <span class="username">{{ auth.displayName }}</span>
        <el-icon><ArrowDown /></el-icon>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, UserFilled } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

/** 面包屑：取 matched 链上的 meta.title（过滤 Layout 无标题节点） */
const breadcrumbs = computed<string[]>(() =>
  route.matched
    .map((r) => (r.meta?.title ? String(r.meta.title) : ''))
    .filter((t) => t !== ''),
)

async function onCommand(command: string): Promise<void> {
  if (command !== 'logout') return
  try {
    await ElMessageBox.confirm('确定退出登录吗？', '提示', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }
  auth.logout()
  await router.push('/login')
}
</script>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #303133;
  outline: none;
}

.username {
  font-size: 14px;
}
</style>
