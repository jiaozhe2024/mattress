#!/usr/bin/env node
/**
 * 由 src/utils/iconSvg.ts 的 lucide path 预渲染原生 custom-tab-bar 所需的 PNG。
 *
 * 为什么需要：微信 custom-tab-bar 是三页共用的原生组件，其中的 <image> 若用
 * data:image/svg+xml 在部分基础库版本渲染不稳定；PNG 是官方推荐做法。
 * 这里「只生成静态资源」，TabBar.vue 页面内仍使用内联 SVG（Icon.vue）。
 *
 * 用法：node scripts/gen-tabbar-icons.mjs [--check]
 *   --check：只校验产物是否与当前 path 一致（退出码 1 表示需要重新生成）。
 *
 * 产物：miniprogram/src/static/tabbar/{home,grid,user}-{normal,active}.png  (48×48 = 24@2x)
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MP_ROOT = path.join(ROOT, "miniprogram");
const OUT_DIR = path.join(MP_ROOT, "src", "static", "tabbar");
const localRequire = createRequire(path.join(MP_ROOT, "package.json"));

const { Resvg } = localRequire("@resvg/resvg-js");

/** 与 src/utils/iconSvg.ts 的 ICON_PATHS 保持同步（脚本侧只取 TabBar 用到的 3 个）。 */
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
};

const STATE_COLOR = { normal: "#4a5165", active: "#1a2260" };

function svgOf(name, state) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${STATE_COLOR[state]}" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round">${ICONS[name]}</svg>`
  );
}

function renderPng(name, state) {
  const resvg = new Resvg(svgOf(name, state), { fitTo: { mode: "width", value: 48 } });
  return resvg.render().asPng();
}

function main() {
  const checkOnly = process.argv.includes("--check");
  mkdirSync(OUT_DIR, { recursive: true });
  const stale = [];
  for (const name of Object.keys(ICONS)) {
    for (const state of Object.keys(STATE_COLOR)) {
      const file = path.join(OUT_DIR, `${name}-${state}.png`);
      const png = renderPng(name, state);
      if (checkOnly) {
        if (!existsSync(file) || !readFileSync(file).equals(png)) stale.push(file);
        continue;
      }
      writeFileSync(file, png);
    }
  }
  if (checkOnly) {
    if (stale.length > 0) {
      console.error(`[stale] 需重新生成：\n${stale.join("\n")}`);
      process.exit(1);
    }
    console.log("[ok] tabbar PNG 与 lucide path 一致");
    return;
  }
  console.log(`[ok] 已生成 ${OUT_DIR}`);
}

main();
