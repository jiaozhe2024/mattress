/**
 * MP-01 小程序骨架自动化验收脚本（miniprogram-automator）
 *
 * 断言内容：
 *   1. 编译产物 app.json 的 tabBar 恰好 3 项（首页/产品/我的）
 *   2. 三个 tab 均可 switchTab 切换且 currentPage.path 正确
 *   3. 首页存在全局悬浮「选款」按钮（.select-fab）
 *   4. 每个 tab 截图保存到 docs/exec-plans/screenshots/
 *
 * 运行前提：
 *   - miniprogram/ 下已 npm install 且 `npm run dev:mp-weixin` 已产出 dist/dev/mp-weixin
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」
 *
 * 用法：node scripts/e2e/skeleton.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞（DevTools 未登录/服务端口未开启等）
 */
const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MP_DIST = path.join(REPO_ROOT, "miniprogram", "dist", "dev", "mp-weixin");
const SHOT_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "screenshots");
const CLI_PATH =
  "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";

const EXPECTED_TABS = [
  { pagePath: "pages/index/index", label: "首页" },
  { pagePath: "pages/product/list", label: "产品" },
  { pagePath: "pages/user/index", label: "我的" },
];

// automator 安装在 miniprogram/ 内，用 createRequire 从其 package.json 位置解析
const localRequire = createRequire(
  require.resolve(path.join("..", "..", "miniprogram", "package.json"))
);
const automator = localRequire("miniprogram-automator");

function assert(cond, message) {
  if (!cond) {
    throw new Error(`[断言失败] ${message}`);
  }
}

function assertStaticConfig() {
  const appJsonPath = path.join(MP_DIST, "app.json");
  assert(fs.existsSync(appJsonPath), `编译产物 app.json 不存在: ${appJsonPath}`);
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  const tabList = appJson.tabBar && appJson.tabBar.list;
  assert(
    Array.isArray(tabList) && tabList.length === 3,
    `tabBar 应恰好 3 项，实际 ${tabList ? tabList.length : 0}`
  );
  for (const tab of EXPECTED_TABS) {
    assert(
      tabList.some((t) => t.pagePath === tab.pagePath),
      `tabBar 缺少 ${tab.label} (${tab.pagePath})`
    );
  }
  console.log(`[1/3] tabBar 配置断言通过：${tabList.map((t) => t.text).join(" / ")}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAutomator() {
  const miniProgram = await automator.launch({
    cliPath: CLI_PATH,
    projectPath: MP_DIST,
  });
  try {
    // 切换三个 tab 并断言 currentPage，逐页截图
    for (let i = 0; i < EXPECTED_TABS.length; i++) {
      const tab = EXPECTED_TABS[i];
      await miniProgram.switchTab("/" + tab.pagePath);
      await sleep(800);
      const page = await miniProgram.currentPage();
      assert(
        page && page.path === tab.pagePath,
        `切换到 ${tab.label} 后 currentPage.path 应为 ${tab.pagePath}，实际 ${page && page.path}`
      );
      if (tab.pagePath === "pages/index/index") {
        const fab = await page.$(".select-fab");
        assert(fab, "首页应存在全局悬浮「选款」按钮（.select-fab）");
      }
      const shotPath = path.join(SHOT_DIR, `mp01-tab${i + 1}-${tab.label}.png`);
      await miniProgram.screenshot({ path: shotPath });
      assert(fs.existsSync(shotPath), `截图未生成: ${shotPath}`);
      console.log(`[2/3] ${tab.label} tab 切换 + 截图通过 → ${shotPath}`);
    }
    console.log("[3/3] MP-01 骨架验收全部通过");
  } finally {
    await miniProgram.close();
  }
}

async function main() {
  assertStaticConfig();
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  try {
    await runAutomator();
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked =
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running/i.test(
        msg
      );
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
    return;
  }
}

main();