<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { silentLogin } from "./utils/auth";

onLaunch(() => {
  // 静默登录：失败静默（dev 无后端时不影响骨架运行）
  silentLogin().catch(() => {});
});
</script>

<style lang="scss">
/* 设计 token 的唯一 CSS 自定义属性出口（真值见 styles/tokens.scss） */
page {
  @include token-css-vars;
  background-color: $color-cream;
}
</style>
