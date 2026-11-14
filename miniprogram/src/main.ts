import { createSSRApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { setReloginHandler } from "./utils/request";
import { silentLogin } from "./utils/auth";

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  // 401 时由 request 触发一次静默重登
  setReloginHandler(silentLogin);
  return {
    app,
  };
}