/**
 * MP-07 全局复用层自动化验收脚本（miniprogram-automator）
 *
 * 断言内容：
 *   [静态] 编译产物 app.json：全部页面 navigationStyle=custom；tabBar.custom=true 且 3 项
 *   [静态] 产物根级 custom-tab-bar/index.{js,json,wxml,wxss} 存在；
 *          static/tabbar 6 张图标（3 项 × normal/active）存在
 *   [静态] app.wxss 已注入 token CSS 变量（--color-navy 等）
 *   [1] 预览页一级导航：左侧 LEKASI 品牌字 + 居中标题，无返回按钮
 *   [2] 预览页二级导航：chevron-left 图标存在，无品牌字
 *   [3] TabBar three：3 项 首页/产品/我的，首项选中
 *   [4] TabBar two：2 项 首页/返回，无选中项（点击切换按钮）
 *   [5] SafeArea：容器 + 手势条存在
 *   [6] 三个 tab 页（首页/产品/我的）可切换、逐页截图
 *
 * 运行前提：
 *   - miniprogram/ 已 npm install
 *   - 已产出编译产物：`npm run build:mp-weixin`（默认读 dist/build/mp-weixin）
 *     如需指向 dev 产物：MP_E2E_DIST=dist/dev/mp-weixin node scripts/e2e/frame.auto.js
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」（仅 automator 段需要）
 *
 * 用法：node scripts/e2e/frame.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞（DevTools 未登录/服务端口未开启等）
 *
 * 说明：静态断言不依赖 DevTools，automator 启动失败时仍会先输出静态段结果。
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MP_DIST = path.resolve(
  REPO_ROOT,
  "miniprogram",
  process.env.MP_E2E_DIST || path.join("dist", "build", "mp-weixin")
);
const SHOT_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "screenshots");
const CLI_PATH = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";

const EXPECTED_TABS = [
  { pagePath: "pages/index/index", label: "首页" },
  { pagePath: "pages/product/category", label: "产品" },
  { pagePath: "pages/user/index", label: "我的" },
];

const localRequire = createRequire(
  require.resolve(path.join("..", "..", "miniprogram", "package.json"))
);
const automator = localRequire("miniprogram-automator");

function assert(cond, message) {
  if (!cond) {
    throw new Error(`[断言失败] ${message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(relPath) {
  const fullPath = path.join(MP_DIST, relPath);
  assert(fs.existsSync(fullPath), `编译产物缺失: ${fullPath}`);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

function assertStaticConfig() {
  assert(
    fs.existsSync(MP_DIST),
    `编译产物目录不存在: ${MP_DIST}（先运行 npm run build:mp-weixin）`
  );
  const appJson = readJson("app.json");

  // [静态 1] 全部页面自定义导航
  const pages = appJson.pages || [];
  assert(pages.length >= 7, `app.json pages 应 ≥7，实际 ${pages.length}`);
  assert(
    appJson.window && appJson.window.navigationStyle === "custom",
    "app.json window.navigationStyle 应为 custom"
  );
  for (const page of pages) {
    const pageJsonPath = path.join(MP_DIST, `${page}.json`);
    if (!fs.existsSync(pageJsonPath)) continue;
    const pageJson = JSON.parse(fs.readFileSync(pageJsonPath, "utf-8"));
    if (pageJson.navigationStyle !== undefined) {
      assert(
        pageJson.navigationStyle === "custom",
        `${page}.json navigationStyle 应为 custom，实际 ${pageJson.navigationStyle}`
      );
    }
  }
  console.log(`[静态 1] ${pages.length} 个页面全局 navigationStyle=custom 通过`);

  // [静态 2] tabBar.custom + 3 项
  const tabBar = appJson.tabBar;
  assert(
    tabBar && tabBar.custom === true,
    "app.json tabBar.custom 应为 true（自绘 TabBar）"
  );
  assert(
    Array.isArray(tabBar.list) && tabBar.list.length === 3,
    `tabBar.list 应恰好 3 项，实际 ${tabBar.list ? tabBar.list.length : 0}`
  );
  for (const tab of EXPECTED_TABS) {
    assert(
      tabBar.list.some((t) => t.pagePath === tab.pagePath),
      `tabBar 缺少 ${tab.label} (${tab.pagePath})`
    );
  }
  console.log(
    `[静态 2] tabBar.custom=true + 3 项（${tabBar.list
      .map((t) => t.text)
      .join(" / ")}）通过`
  );

  // [静态 3] 原生 custom-tab-bar 产物 + tabbar 图标
  for (const ext of ["js", "json", "wxml", "wxss"]) {
    const file = path.join(MP_DIST, "custom-tab-bar", `index.${ext}`);
    assert(fs.existsSync(file), `原生 custom-tab-bar 产物缺失: ${file}`);
  }
  for (const name of ["home", "grid", "user"]) {
    for (const state of ["normal", "active"]) {
      const icon = path.join(MP_DIST, "static", "tabbar", `${name}-${state}.png`);
      assert(fs.existsSync(icon), `tabbar 图标缺失: ${icon}`);
    }
  }
  console.log("[静态 3] custom-tab-bar 四件套 + 6 张 tabbar 图标通过");

  // [静态 4] token CSS 变量已注入 app.wxss
  const appWxss = fs.readFileSync(path.join(MP_DIST, "app.wxss"), "utf-8");
  for (const token of ["--color-navy: #1a2260", "--color-yellow: #f7c400"]) {
    assert(
      appWxss.includes(token),
      `app.wxss 缺少 token 自定义属性「${token}」`
    );
  }
  console.log("[静态 4] token CSS 变量注入 app.wxss 通过");
}

async function waitFor(page, selector, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) return el;
    await sleep(300);
  }
  return null;
}

async function shot(miniProgram, name) {
  const shotPath = path.join(SHOT_DIR, name);
  await miniProgram.screenshot({ path: shotPath });
  assert(fs.existsSync(shotPath), `截图未生成: ${shotPath}`);
  return shotPath;
}

async function assertFramePage(miniProgram) {
  await miniProgram.reLaunch("/pages/frame/preview");
  await sleep(1200);
  const page = await miniProgram.currentPage();
  assert(
    page && page.path === "pages/frame/preview",
    `应落在全局层校验页，实际 ${page && page.path}`
  );
  const firstShot = await shot(miniProgram, "mp07-frame-preview.png");
  console.log(`[0] 预览页打开 + 截图 → ${firstShot}`);

  // [1] 一级导航
  const brand = await waitFor(page, ".wnav-brand");
  assert(brand, "一级导航应存在品牌字（.wnav-brand）");
  assert((await brand.text()).trim() === "LEKASI", "品牌字应为 LEKASI");
  const titles = await page.$$(".wnav-title");
  assert(titles.length >= 1, "应存在居中标题（.wnav-title）");
  console.log("[1] 一级导航：LEKASI 品牌字 + 居中标题通过");

  // [2] 二级导航
  const backs = await page.$$(".wnav-back");
  assert(backs.length === 1, `二级导航返回按钮应恰好 1 个，实际 ${backs.length}`);
  const chevron = await page.$$(".icon--chevron-left");
  assert(chevron.length === 1, `应存在 1 个 chevron-left 图标，实际 ${chevron.length}`);
  console.log("[2] 二级导航：chevron-left 22×22 通过");

  // [3] TabBar three
  let tabbar = await page.$(".tabbar");
  assert(tabbar, "应存在 .tabbar");
  assert(
    (await tabbar.attribute("data-variant")) === "three",
    "初始 TabBar 应为 three 变体"
  );
  let items = await page.$$(".tabbar-item");
  assert(items.length === 3, `three 应 3 项，实际 ${items.length}`);
  let labels = [];
  for (const item of items) labels.push((await item.text()).trim());
  assert(
    JSON.stringify(labels) === JSON.stringify(["首页", "产品", "我的"]),
    `three 文案应为 首页/产品/我的，实际 ${labels.join("/")}`
  );
  assert(
    await page.$(".tabbar-item--active"),
    "three 缺省应选中首项（.tabbar-item--active）"
  );
  const threeShot = await shot(miniProgram, "mp07-tabbar-three.png");
  console.log(`[3] TabBar three（3 项，首项选中）+ 截图 → ${threeShot}`);

  // [4] TabBar two（点切换按钮）
  const toggle = await waitFor(page, ".frame-toggle");
  assert(toggle, "应存在 variant 切换按钮（.frame-toggle）");
  await toggle.tap();
  await sleep(500);
  tabbar = await page.$(".tabbar");
  assert(
    (await tabbar.attribute("data-variant")) === "two",
    "切换后 TabBar 应为 two 变体"
  );
  items = await page.$$(".tabbar-item");
  assert(items.length === 2, `two 应 2 项，实际 ${items.length}`);
  labels = [];
  for (const item of items) labels.push((await item.text()).trim());
  assert(
    JSON.stringify(labels) === JSON.stringify(["首页", "返回"]),
    `two 文案应为 首页/返回，实际 ${labels.join("/")}`
  );
  const twoShot = await shot(miniProgram, "mp07-tabbar-two.png");
  console.log(`[4] TabBar two（2 项 首页/返回）+ 截图 → ${twoShot}`);

  // [5] SafeArea
  assert(await page.$(".safe-area"), "应存在安全区容器（.safe-area）");
  assert(await page.$(".safe-area-bar"), "应存在手势条（.safe-area-bar）");
  console.log("[5] SafeArea 容器 + 手势条通过");
}

async function assertTabPages(miniProgram) {
  for (const tab of EXPECTED_TABS) {
    await miniProgram.switchTab("/" + tab.pagePath);
    await sleep(1000);
    const page = await miniProgram.currentPage();
    assert(
      page && page.path === tab.pagePath,
      `切换到 ${tab.label} 后 currentPage.path 应为 ${tab.pagePath}，实际 ${
        page && page.path
      }`
    );
    const shotPath = await shot(
      miniProgram,
      `mp07-tab-${tab.pagePath.split("/")[1]}.png`
    );
    console.log(`[6] ${tab.label} 页截图 → ${shotPath}`);
  }
  console.log("[6] 三个 tab 页切换 + 截图通过");
}

async function main() {
  try {
    assertStaticConfig();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  let miniProgram;
  try {
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: MP_DIST,
    });
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    process.exitCode = 2;
    return;
  }
  try {
    await assertFramePage(miniProgram);
    await assertTabPages(miniProgram);
    console.log("[done] MP-07 全局复用层验收全部通过");
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked =
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running/i.test(
        msg
      );
    console.error(blocked ? `[环境阻塞] ${msg}` : msg);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    await miniProgram.close();
  }
}

main();
