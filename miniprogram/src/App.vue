<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { silentLogin } from "./utils/auth";

onLaunch(() => {
  // 静默登录：失败静默（dev 无后端时不影响骨架运行）
  silentLogin().catch(() => {});
});
</script>

<style>
page {
  background-color: #f8f8f8;
}
</style>