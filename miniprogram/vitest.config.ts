import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

/** uni-app 的内置标签在小程序产物中是原生组件；测试环境按自定义元素渲染。 */
const UNI_ELEMENTS = new Set([
  "view",
  "text",
  "image",
  "block",
  "scroll-view",
  "swiper",
  "swiper-item",
  "cover-view",
  "cover-image",
  "button",
  "input",
  "navigator",
  "rich-text",
]);

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag: string): boolean => UNI_ELEMENTS.has(tag),
        },
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://test-api"),
    "import.meta.env.VITE_USE_WX_MOCK": JSON.stringify("true"),
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
