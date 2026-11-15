<template>
  <div>
    <el-card>
      <template #header>
        <div class="card-header">
          <span>预置角色</span>
          <el-button :loading="loading" @click="fetchRoles">刷新</el-button>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        class="intro"
        title="预置角色由后端启动时幂等落库，并按职责绑定菜单。角色的增删改与菜单授权在「系统管理」内维护。"
      />

      <el-table v-loading="loading" :data="roles" border stripe>
        <el-table-column prop="name" label="角色名称" width="140" />
        <el-table-column prop="desc" label="职责说明" min-width="280" show-overflow-tooltip />
        <el-table-column label="落库状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.exists ? 'success' : 'warning'" size="small">
              {{ row.exists ? '已创建' : '未创建' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色 ID" width="100">
          <template #default="{ row }">{{ row.role_id ?? '-' }}</template>
        </el-table-column>
        <el-table-column label="已绑菜单" min-width="240">
          <template #default="{ row }">
            <template v-if="row.menu_paths.length > 0">
              <el-tag
                v-for="path in row.menu_paths"
                :key="path"
                size="small"
                class="menu-tag"
              >
                {{ path }}
              </el-tag>
            </template>
            <el-text v-else size="small" type="info">
              {{ row.key === 'super_admin' ? '不绑菜单（is_superuser 全放行）' : '未绑定' }}
            </el-text>
          </template>
        </el-table-column>
      </el-table>

      <el-alert
        type="warning"
        :closable="false"
        class="footnote"
        title="菜单可见性变化：给角色增删菜单绑定后，该角色下用户登录可见的菜单随之变化（后端 /menu/list 按角色过滤）。"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { listPresetRoles } from '@/api/system'
import type { PresetRoleItem } from '@/types/system'

/**
 * 预置角色（BE-09）。
 *
 * 只读视图：预置角色（超级管理员/内容管理员/运营人员）由后端 init_preset_roles
 * 幂等落库并按职责绑定菜单。真正的角色增删改与菜单授权走基座 /api/v1/role、
 * /api/v1/menu，本页不重复提供入口，只回答「现在落库了没、绑了哪些菜单」。
 */

const loading = ref(false)
const roles = ref<PresetRoleItem[]>([])

async function fetchRoles(): Promise<void> {
  loading.value = true
  try {
    roles.value = await listPresetRoles()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchRoles()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.intro {
  margin-bottom: 12px;
}

.footnote {
  margin-top: 12px;
}

.menu-tag {
  margin: 2px 4px 2px 0;
}
</style>
