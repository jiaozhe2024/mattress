<script setup lang="ts">
import { onLaunch } from "@dcloudio/uni-app";
import { silentLogin } from "./utils/auth";
import { setAuthReady } from "./utils/request";

onLaunch(() => {
  // 静默登录：失败静默（dev 无后端时不影响骨架运行）。
  // 同时把 Promise 交给请求层，让首个业务请求等登录落定后再发，
  // 避免「启动即请求 → 无 token 必 401 → 依赖重试」的脆弱链路。
  setAuthReady(silentLogin().catch(() => {}));
});
</script>

<style lang="scss">
/* 设计 token 的唯一 CSS 自定义属性出口（真值见 styles/tokens.scss） */
page {
  @include token-css-vars;
  background-color: $color-cream;
}
</style>
