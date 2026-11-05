import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
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