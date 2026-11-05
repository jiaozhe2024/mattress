<template>
  <el-container class="layout-root">
    <el-aside width="220px" class="layout-aside">
      <div class="logo">床垫选品管理后台</div>
      <SideMenu />
    </el-aside>
    <el-container>
      <el-header class="layout-header">
        <NavBar />
      </el-header>
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import NavBar from '@/layout/components/NavBar.vue'
import SideMenu from '@/layout/components/SideMenu.vue'
</script>

<style scoped>
.layout-root {
  height: 100%;
}

.layout-aside {
  background-color: #001529;
  overflow-x: hidden;
}

.logo {
  height: 56px;
  line-height: 56px;
  text-align: center;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  background-color: #002140;
}

.layout-header {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
}

.layout-main {
  background: #f5f7fa;
  padding: 16px;
}
</style>
