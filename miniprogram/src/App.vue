<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { silentLogin } from "./utils/auth";

onLaunch(() => {
  // 静默登录：失败静默（dev 无后端时不影响骨架运行）
  silentLogin().catch(() => {});
});
</script>

<style>
/* 设计 token cream 背景（docs/design/figma-exports/ds-page.png） */
page {
  background-color: #fdfbf5;
}
</style>