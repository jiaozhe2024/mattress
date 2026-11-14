/**
 * MP-03 产品列表页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-03 verify）：
 *   0. 后端 GET /wxapi/products + /wxapi/categories 可达（数据基准，不可达=环境阻塞）
 *   1. 左侧分类侧边导航渲染：侧边项数 = 后端分类数 + 1（「全部」）
 *   2. 首屏产品卡片渲染，数量与后端 page=1/size=10 一致；截图对照
 *   3. 搜索「卷绵」命中并渲染（卡片数与后端 keyword 结果一致）
 *   4. 搜索无结果关键词显示空态（.pl-state）
 *   5. 清空搜索恢复全部产品
 *   6. 分类切换列表刷新（侧边高亮迁移 + 卡片数与后端 category_id 结果一致）
 *   7. 排序切换生效（active tab 迁移 + 列表重载）
 *   8. 视图切换（宫格 ⇄ 列表 class 切换）
 *   9. 点卡片「+」加入选品：底部已选栏出现、数量+缩略图更新、该卡片按钮置灰
 *  10. 从已选栏移除：数量减少 / 归零后已选栏消失
 *  11. 已选栏 OK 点击（MP-05 未落地：跳 /pages/scheme/edit 失败→toast，停留在列表页）
 *
 * 运行前提：
 *   - 后端 docker compose up 且 seed 已灌（/wxapi/products、/wxapi/categories 200）
 *   - miniprogram/ 已 npm install 且 `npm run dev:mp-weixin` 产出 dist/dev/mp-weixin
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」
 *
 * 用法：node scripts/e2e/product-list.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞（后端不可达/DevTools 未登录/服务端口未开启等）
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MP_DIST = path.join(REPO_ROOT, "miniprogram", "dist", "dev", "mp-weixin");
const SHOT_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "screenshots");
const CLI_PATH = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const API_BASE = "http://localhost:8000/api/v1";
const PRODUCTS_API = `${API_BASE}/wxapi/products`;
const CATEGORIES_API = `${API_BASE}/wxapi/categories`;
const PAGE_SIZE = 10;

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
          if (!body || body.code !== 200) {
            reject(new Error(`接口返回异常: ${raw.slice(0, 200)}`));
            return;
          }
          resolve(body.data);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error(`接口超时: ${url}`)));
  });
}

function buildProductsUrl(query = {}) {
  const params = new URLSearchParams({
    page: "1",
    size: String(PAGE_SIZE),
    ...Object.fromEntries(
      Object.entries(query).map(([k, v]) => [k, String(v)])
    ),
  });
  return `${PRODUCTS_API}?${params.toString()}`;
}

async function waitFor(page, selector, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) return el;
    await sleep(400);
  }
  return null;
}

async function waitForGone(page, selector, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (!el) return true;
    await sleep(400);
  }
  return false;
}

// 轮询直到卡片数 === expected（覆盖 300ms 防抖 + 网络往返），返回实际卡片数
async function waitForCardCount(page, expected, timeoutMs = 12000) {
  const start = Date.now();
  let count = -1;
  while (Date.now() - start < timeoutMs) {
    count = (await page.$$(".pcard")).length;
    if (count === expected) return count;
    await sleep(400);
  }
  return count;
}

async function setKeyword(page, value) {
  const input = await page.$(".pl-search-input");
  assert(input, "应存在搜索输入框（.pl-search-input）");
  // onInput 读 event.detail.value；trigger 第二参作为 detail 注入
  await input.trigger("input", { value });
  await sleep(350); // 越过 300ms 防抖窗口
}

async function runAssertions(miniProgram, baseline) {
  // MP-03A 起产品列表脱离 tabBar（「产品」tab = 分类页），以普通页 navigateTo 进入
  await miniProgram.navigateTo("/pages/product/list");
  await sleep(1200);
  const page = await miniProgram.currentPage();
  assert(
    page && page.path === "pages/product/list",
    `navigateTo 应落在产品列表页，实际 ${page && page.path}`
  );

  // [1] 分类侧边导航：侧边项 = 后端分类数 + 1（「全部」）
  const sideItems = await waitFor(page, ".pl-side-item", 10000);
  assert(sideItems, "应渲染分类侧边导航（.pl-side-item），加载超时或接口失败");
  const allSide = await page.$$(".pl-side-item");
  assert(
    allSide.length === baseline.categories.length + 1,
    `侧边项数应=分类数(${baseline.categories.length})+1，实际 ${allSide.length}`
  );
  console.log(`[1] 分类侧边导航渲染通过（${allSide.length} 项，含「全部」）`);

  // [2] 首屏卡片数 = 后端 page=1/size=10 total 截断
  const expectedFirst = Math.min(baseline.firstPage.total, PAGE_SIZE);
  const firstCount = await waitForCardCount(page, expectedFirst);
  assert(
    firstCount === expectedFirst,
    `首屏卡片数应=${expectedFirst}，实际 ${firstCount}`
  );
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const shotPath = path.join(SHOT_DIR, "mp03-product-list.png");
  await miniProgram.screenshot({ path: shotPath });
  assert(fs.existsSync(shotPath), `截图未生成: ${shotPath}`);
  console.log(`[2] 首屏卡片渲染通过（${firstCount} 张）+ 截图 → ${shotPath}`);

  // [3] 搜索「卷绵」命中并渲染
  await setKeyword(page, "卷绵");
  const expectedKw = Math.min(baseline.keyword.total, PAGE_SIZE);
  const kwCount = await waitForCardCount(page, expectedKw);
  assert(expectedKw > 0, "后端 keyword=卷绵 应命中 seed 数据（total>0）");
  assert(
    kwCount === expectedKw,
    `搜索「卷绵」卡片数应=${expectedKw}，实际 ${kwCount}`
  );
  console.log(`[3] 搜索「卷绵」命中并渲染通过（${kwCount} 张）`);

  // [4] 无结果关键词 → 空态
  await setKeyword(page, "zzz不存在的产品xyz");
  const emptyState = await waitFor(page, ".pl-state-text", 8000);
  assert(emptyState, "无结果搜索应显示空态（.pl-state-text）");
  const emptyCards = (await page.$$(".pcard")).length;
  assert(emptyCards === 0, `空态下不应有产品卡片，实际 ${emptyCards} 张`);
  console.log("[4] 无结果搜索显示空态通过");

  // [5] 清空搜索恢复全部
  const clearBtn = await page.$(".pl-search-clear");
  assert(clearBtn, "应存在清空搜索按钮（.pl-search-clear）");
  await clearBtn.tap();
  const restoredCount = await waitForCardCount(page, expectedFirst);
  assert(
    restoredCount === expectedFirst,
    `清空搜索应恢复首屏 ${expectedFirst} 张，实际 ${restoredCount}`
  );
  console.log("[5] 清空搜索恢复全部产品通过");

  // [6] 分类切换列表刷新（切到后端第 2 个分类，index=2 因 index=0 为「全部」）
  if (baseline.categories.length >= 2) {
    const targetCategory = baseline.categories[1];
    const sideList = await page.$$(".pl-side-item");
    await sideList[2].tap();
    await sleep(1000);
    const activeSide = await page.$(".pl-side-item--active");
    assert(activeSide, "分类切换后应有高亮侧边项（.pl-side-item--active）");
    const activeText = (await activeSide.text()).trim();
    assert(
      activeText.includes(targetCategory.name),
      `高亮侧边项应为「${targetCategory.name}」，实际「${activeText}」`
    );
    const catData = await fetchJson(
      buildProductsUrl({ category_id: targetCategory.id })
    );
    const expectedCat = Math.min(catData.total, PAGE_SIZE);
    const catCount = await waitForCardCount(page, expectedCat);
    assert(
      catCount === expectedCat,
      `分类「${targetCategory.name}」卡片数应=${expectedCat}，实际 ${catCount}`
    );
    // 切回「全部」
    const sideList2 = await page.$$(".pl-side-item");
    await sideList2[0].tap();
    await sleep(1000);
    await waitForCardCount(page, expectedFirst);
    console.log(
      `[6] 分类切换列表刷新通过（${targetCategory.name}: ${catCount} 张）`
    );
  } else {
    console.log("[6] 后端分类 <2，分类切换断言跳过");
  }

  // [7] 排序切换生效（点「新品」tab，active 迁移 + 列表重载）
  const sortTabs = await page.$$(".pl-sort-tab");
  assert(sortTabs.length >= 3, `排序 tab 应≥3（综合/推荐/新品），实际 ${sortTabs.length}`);
  await sortTabs[2].tap(); // 新品
  await sleep(1000);
  const activeSort = await page.$(".pl-sort-tab--active");
  assert(activeSort, "排序切换后应有高亮 tab（.pl-sort-tab--active）");
  const activeSortText = (await activeSort.text()).trim();
  assert(
    activeSortText.includes("新品"),
    `高亮排序 tab 应为「新品」，实际「${activeSortText}」`
  );
  // 新品排序后端有数据时应仍渲染卡片（重载成功）
  const newestData = await fetchJson(buildProductsUrl({ sort: "newest" }));
  const expectedNewest = Math.min(newestData.total, PAGE_SIZE);
  const newestCount = await waitForCardCount(page, expectedNewest);
  assert(
    newestCount === expectedNewest,
    `新品排序卡片数应=${expectedNewest}，实际 ${newestCount}`
  );
  // 切回综合
  const sortTabs2 = await page.$$(".pl-sort-tab");
  await sortTabs2[0].tap();
  await sleep(1000);
  console.log("[7] 排序切换生效通过（新品 active + 列表重载）");

  // [8] 视图切换：宫格 ⇄ 列表
  const cardsWrap = await page.$(".pl-cards");
  assert(cardsWrap, "应存在卡片容器（.pl-cards）");
  const beforeClass = (await cardsWrap.attribute("class")) || "";
  assert(
    beforeClass.includes("pl-cards--grid"),
    `默认应为宫格视图（pl-cards--grid），实际 class=${beforeClass}`
  );
  const toggle = await page.$(".pl-view-toggle");
  assert(toggle, "应存在视图切换按钮（.pl-view-toggle）");
  await toggle.tap();
  await sleep(500);
  const afterClass = (await cardsWrap.attribute("class")) || "";
  assert(
    afterClass.includes("pl-cards--list"),
    `切换后应为列表视图（pl-cards--list），实际 class=${afterClass}`
  );
  await toggle.tap();
  await sleep(400);
  console.log("[8] 视图切换（宫格⇄列表）通过");

  // [9] 点「+」加入选品：底部栏出现、数量+缩略图更新、卡片按钮置灰
  const addBtns = await page.$$(".pcard-add");
  assert(addBtns.length >= 1, "应至少有一个产品卡片的加入按钮（.pcard-add）");
  await addBtns[0].tap();
  await sleep(800);
  const selBar = await waitFor(page, ".sel-bar", 6000);
  assert(selBar, "加入选品后应出现底部已选栏（.sel-bar）");
  const countText = await (await page.$(".sel-bar-count")).text();
  assert(
    /1/.test(countText),
    `已选栏数量应含 1，实际「${countText.trim()}」`
  );
  const thumbs = await page.$$(".sel-bar-thumb");
  assert(thumbs.length === 1, `已选栏缩略图应=1，实际 ${thumbs.length}`);
  const firstAddClass = (await addBtns[0].attribute("class")) || "";
  assert(
    firstAddClass.includes("pcard-add--added"),
    `已加入卡片按钮应置灰（pcard-add--added），实际 class=${firstAddClass}`
  );
  console.log("[9] 加入选品：底部栏数量+缩略图更新、卡片按钮置灰通过");

  // [11] 已选栏 OK 点击（MP-05 未落地：目标 /pages/scheme/edit 不存在→停留列表页）
  const okBtn = await page.$(".sel-bar-ok");
  assert(okBtn, "已选栏应存在 OK 按钮（.sel-bar-ok）");
  await okBtn.tap();
  await sleep(1000);
  const afterOk = await miniProgram.currentPage();
  assert(
    afterOk.path === "pages/product/list",
    `MP-05 未落地，OK 应停留列表页（跳转失败回退），实际 ${afterOk.path}`
  );
  console.log(
    "[11] OK 点击：MP-05 未落地，跳 /pages/scheme/edit 失败回退停留列表页（符合当前范围）"
  );

  // [10] 从已选栏移除 → 归零后已选栏消失
  const removeBtn = await page.$(".sel-bar-thumb-remove");
  assert(removeBtn, "已选栏缩略图应有移除按钮（.sel-bar-thumb-remove）");
  await removeBtn.tap();
  const gone = await waitForGone(page, ".sel-bar", 6000);
  assert(gone, "移除唯一选品后底部已选栏应消失（selectedCount=0）");
  console.log("[10] 已选栏移除产品 → 归零后消失通过");

  console.log("[done] MP-03 产品列表页验收全部通过");
}

async function main() {
  let baseline;
  try {
    const [firstPage, categories, keyword] = await Promise.all([
      fetchJson(buildProductsUrl()),
      fetchJson(CATEGORIES_API),
      fetchJson(buildProductsUrl({ keyword: "卷绵" })),
    ]);
    baseline = { firstPage, categories, keyword };
  } catch (err) {
    console.error(
      `[环境阻塞] 后端产品/分类接口不可达（${PRODUCTS_API} / ${CATEGORIES_API}）：${err.message}`
    );
    process.exitCode = 2;
    return;
  }
  console.log(
    `[0] 后端可达：products.total=${baseline.firstPage.total} categories=${baseline.categories.length} keyword「卷绵」.total=${baseline.keyword.total}`
  );

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
    await runAssertions(miniProgram, baseline);
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
