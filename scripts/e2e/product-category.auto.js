/**
 * MP-03A 产品分类列表页自动化验收脚本（miniprogram-automator，V3 版）
 *
 * 断言内容（对照 tasks.json MP-03A verify）：
 *   [静态] 编译产物 app.json：tabBar 第二项 pagePath = pages/product/category
 *          （pages/product/list 仍注册在 pages 数组内，不再是 tab 页）
 *   [0] 后端 GET /wxapi/categories 可达（数据基准，不可达=环境阻塞）
 *   [1] switchTab「产品」→ 落在分类页；系列横幅存在且三行文案逐字吻合
 *   [2] 分类入口数 = 后端分类数（本轮 8）；每条标题与副文案非空
 *   [3] 每条入口右侧有 chevron-right 图标；无版本标识条（Q12）
 *   [4] 点第 1 个分类 → 跳 /pages/product/list 且 category_id 与所点分类一致
 *   [5] 底部原生 TabBar「产品」为选中态；选款 FAB 64×42 胶囊常驻
 *   [6] 截图保存到 docs/exec-plans/screenshots/（与 references/product-category.png 逐区块比对）
 *
 * 运行前提：
 *   - 后端 docker compose up 且 seed 已灌（/wxapi/categories 200）
 *   - miniprogram/ 已 npm install 且 `npm run build:mp-weixin`（默认读 dist/build/mp-weixin）
 *     如需指向 dev 产物：MP_E2E_DIST=dist/dev/mp-weixin node scripts/e2e/product-category.auto.js
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」（仅 automator 段需要）
 *
 * 用法：node scripts/e2e/product-category.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞（后端不可达/DevTools 未登录/服务端口未开启等）
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MP_DIST = path.resolve(
  REPO_ROOT,
  "miniprogram",
  process.env.MP_E2E_DIST || path.join("dist", "build", "mp-weixin")
);
const SHOT_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "screenshots");
const CLI_PATH = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const CATEGORIES_API = "http://localhost:8000/api/v1/wxapi/categories";

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          const body = JSON.parse(raw);
          if (!body || body.code !== 200 || body.data === undefined) {
            reject(new Error(`${url} 返回异常: ${raw.slice(0, 200)}`));
            return;
          }
          resolve(body.data);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error(`${url} 超时`)));
  });
}

function assertStaticConfig() {
  const appJsonPath = path.join(MP_DIST, "app.json");
  assert(fs.existsSync(appJsonPath), `编译产物 app.json 不存在: ${appJsonPath}（先 build）`);
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
  const tabList = (appJson.tabBar && appJson.tabBar.list) || [];
  assert(tabList.length === 3, `tabBar 应 3 项，实际 ${tabList.length}`);
  assert(
    tabList[1].pagePath === "pages/product/category",
    `tabBar 第二项应为 pages/product/category，实际 ${tabList[1].pagePath}`
  );
  assert(
    appJson.pages.includes("pages/product/list"),
    "pages/product/list 应仍注册在 pages 数组（降级为普通页）"
  );
  assert(
    !tabList.some((item) => item.pagePath === "pages/product/list"),
    "pages/product/list 不应再出现在 tabBar.list"
  );
  console.log(
    `[静态] tabBar 第二项 = pages/product/category；pages/product/list 仍注册且已脱离 tabBar 通过`
  );
}

async function waitFor(page, selector, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) return el;
    await sleep(500);
  }
  return null;
}

async function sizeOf(element) {
  const size = await element.size();
  return {
    width: Number.parseFloat(String(size.width)),
    height: Number.parseFloat(String(size.height)),
    raw: size,
  };
}

async function readQuery(page) {
  // automator 的 Page.query 返回页面 onLoad options（老版本返回 {}）
  try {
    const query = await page.query;
    return query && typeof query === "object" ? query : {};
  } catch {
    return {};
  }
}

async function runAssertions(miniProgram, categoriesData) {
  await miniProgram.switchTab("/pages/product/category");
  await sleep(1500);
  const page = await miniProgram.currentPage();
  assert(
    page && page.path === "pages/product/category",
    `switchTab 应落在产品分类页，实际 ${page && page.path}`
  );

  // [1] 系列横幅
  const banner = await waitFor(page, ".pc-banner", 10000);
  assert(banner, "应存在系列横幅（.pc-banner），加载超时或接口失败");
  const brand = (await (await page.$(".pc-banner-brand")).text()).trim();
  assert(brand === "LEKASI 乐卡思", `横幅品牌行应为「LEKASI 乐卡思」，实际「${brand}」`);
  const title = (await (await page.$(".pc-banner-title")).text()).trim();
  assert(title === "9M 特制床垫", `横幅标题应为「9M 特制床垫」，实际「${title}」`);
  const subtitle = (await (await page.$(".pc-banner-subtitle")).text()).trim();
  assert(
    subtitle === "让每一次休息，都更舒适",
    `横幅副标题文案不符，实际「${subtitle}」`
  );
  const bannerImage = await page.$(".pc-banner-image");
  assert(bannerImage, "系列横幅应含床垫展示图（.pc-banner-image）");
  console.log("[1] 系列横幅（品牌行 / 标题 / 副标题 / 展示图）通过");

  // [2] 分类入口 = 后端分类数，标题与副文案非空
  const entries = await page.$$(".pc-entry");
  assert(
    entries.length === categoriesData.length,
    `分类入口数应=${categoriesData.length}，实际 ${entries.length}`
  );
  assert(entries.length === 8, `本轮分类入口应=8（Q15），实际 ${entries.length}`);
  const textChannel = categoriesData.every(
    (category) => category.banner_image === null
  );
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (textChannel) {
      const titleEl = await entry.$(".pc-entry-title");
      const subtitleEl = await entry.$(".pc-entry-subtitle");
      assert(titleEl, `第 ${i + 1} 个分类缺标题（.pc-entry-title）`);
      assert(subtitleEl, `第 ${i + 1} 个分类缺副文案（.pc-entry-subtitle）`);
      const titleText = (await titleEl.text()).trim();
      const subtitleText = (await subtitleEl.text()).trim();
      assert(titleText !== "", `第 ${i + 1} 个分类标题为空`);
      assert(subtitleText !== "", `第 ${i + 1} 个分类副文案为空`);
      assert(
        titleText === categoriesData[i].name,
        `第 ${i + 1} 个分类标题应为「${categoriesData[i].name}」，实际「${titleText}」`
      );
    } else {
      const imageEl = await entry.$(".pc-entry-image");
      assert(imageEl, `第 ${i + 1} 个分类 banner_image 非空时应渲染图片）`);
    }
  }
  console.log(`[2] 分类入口 ${entries.length} 项，标题与副文案均非空通过`);

  // [3] chevron-right 数量 + 无版本条（Q12）
  const chevrons = await page.$$(".icon--chevron-right");
  assert(
    chevrons.length === entries.length,
    `每条分类入口应有 1 个 chevron-right，期望 ${entries.length}，实际 ${chevrons.length}`
  );
  const versionBar = await page.$(".version-bar");
  assert(versionBar === null, "分类页不应有版本标识条（.version-bar，Q12）");
  const bodyText = await (await page.$(".pc-body")).text();
  assert(
    !bodyText.includes("参考复刻优化版"),
    "分类页正文不应含「参考复刻优化版」（Q12）"
  );
  console.log("[3] 每项 chevron-right + 无版本标识条通过");

  // [4] 点第 1 个分类 → 产品列表页且 category_id 匹配
  const firstCategoryId = categoriesData[0].id;
  await entries[0].tap();
  await sleep(1500);
  const listPage = await miniProgram.currentPage();
  assert(
    listPage && listPage.path === "pages/product/list",
    `点第 1 个分类应跳 /pages/product/list，实际 ${listPage && listPage.path}`
  );
  let queryCategoryId = "";
  const query = await readQuery(listPage);
  if (query && query.category_id !== undefined) {
    queryCategoryId = String(query.category_id);
  }
  if (queryCategoryId === "") {
    // automator 不暴露 options 时，用列表页选中态反推分类已生效（active side item 文案）
    const activeSide = await waitFor(listPage, ".pl-side-item--active", 10000);
    assert(activeSide, "产品列表页应有高亮的分类侧边项（.pl-side-item--active）");
    const activeText = (await activeSide.text()).trim();
    assert(
      activeText === categoriesData[0].name,
      `列表页高亮分类应为「${categoriesData[0].name}」，实际「${activeText}」`
    );
  } else {
    assert(
      queryCategoryId === String(firstCategoryId),
      `列表页 category_id 应为 ${firstCategoryId}，实际 ${queryCategoryId}`
    );
  }
  console.log(
    `[4] 点第 1 个分类（id=${firstCategoryId}）→ /pages/product/list 且分类条件生效通过`
  );

  // [5] 回分类页：TabBar「产品」选中态 + 选款 FAB 胶囊
  await miniProgram.switchTab("/pages/product/category");
  await sleep(1200);
  const backPage = await miniProgram.currentPage();
  assert(
    backPage && backPage.path === "pages/product/category",
    `应回到产品分类页，实际 ${backPage && backPage.path}`
  );
  const tabItems = await backPage.$$(".tabbar-item");
  assert(tabItems.length === 3, `原生 TabBar 应 3 项，实际 ${tabItems.length}`);
  const productTabClass = (await tabItems[1].attribute("class")) || "";
  assert(
    productTabClass.includes("tabbar-item--active"),
    `TabBar「产品」应为选中态，实际 class=${productTabClass}`
  );
  const fab = await waitFor(backPage, ".select-fab");
  assert(fab, "分类页应常驻选款 FAB（.select-fab）");
  const fabSize = await sizeOf(fab);
  assert(
    Math.abs(fabSize.width - 64) <= 1 && Math.abs(fabSize.height - 42) <= 1,
    `选款 FAB 应为 64×42 胶囊，实际 ${JSON.stringify(fabSize.raw)}`
  );
  console.log("[5] TabBar「产品」选中 + 选款 FAB 64×42 通过");

  // [6] 截图（与 references/product-category.png 逐区块比对用）
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const shotPath = path.join(SHOT_DIR, "mp03a-product-category.png");
  await miniProgram.screenshot({ path: shotPath });
  assert(fs.existsSync(shotPath), `截图未生成: ${shotPath}`);
  console.log(`[6] 分类页截图 → ${shotPath}`);

  console.log("[done] MP-03A 产品分类列表页验收全部通过");
}

async function main() {
  let categoriesData;
  try {
    categoriesData = await fetchJson(CATEGORIES_API);
  } catch (err) {
    console.error(`[环境阻塞] 后端分类接口不可达（${CATEGORIES_API}）：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[0] 接口可达：categories=${categoriesData.length}`);

  try {
    assertStaticConfig();
  } catch (err) {
    console.error(`[断言失败] ${String((err && err.message) || err)}`);
    process.exitCode = 1;
    return;
  }

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
    await runAssertions(miniProgram, categoriesData);
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked =
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running/i.test(
        msg
      );
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    await miniProgram.close();
  }
}

main();
