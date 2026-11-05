<template>
  <div>
    <el-card>
      <template #header>工作台</template>
      <p>欢迎，{{ auth.displayName }}！</p>
      <p class="hint">
        当前为 BE-03 骨架：登录 / 布局 / 路由守卫 / RBAC 菜单过滤 / axios 封装已就绪。
        业务管理模块（轮播图、分类、产品、资讯、品牌、用户、方案）将在 BE-08 / BE-09 接入。
      </p>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户名">
          {{ auth.userInfo?.username ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="角色">
          {{ roleText }}
        </el-descriptions-item>
        <el-descriptions-item label="超级管理员">
          {{ auth.isSuperuser ? '是' : '否' }}
        </el-descriptions-item>
        <el-descriptions-item label="最后登录">
          {{ auth.userInfo?.last_login ?? '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const roleText = computed(() => {
  if (auth.isSuperuser) return '超级管理员'
  const names = auth.userInfo?.roles.map((r) => r.name) ?? []
  return names.length > 0 ? names.join('、') : '未绑定角色'
})
</script>

<style scoped>
.hint {
  color: #909399;
  font-size: 13px;
}
</style>
