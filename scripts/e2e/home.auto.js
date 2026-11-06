/**
 * MP-02 首页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容：
 *   0. 后端 GET /api/v1/wxapi/home 可达（数据基准，不可达=环境阻塞）
 *   1. banner swiper 存在、slide 数与后端一致；首页截图对照设计稿
 *   2. 分类宫格入口数 = 7（.category-cell，不含「更多系列」占位 .category-more）
 *   3. jump_type=2 的 banner 点击跳产品列表且携带对应 category_id（Pinia 传参占位文案）
 *   4. 品牌服务横滚 scroll-view 存在、卡片数与后端 services 一致、点卡片跳资讯详情
 *   5. 资讯入口跳 pages/article/list
 *   6. 悬浮选款按钮点击跳转（MP-05 未落地前回退=产品列表 tab）
 *   7. autoplay 5s 轮播（swiper current 变化）
 *
 * 运行前提：
 *   - 后端 docker compose up 且 seed 已灌（/api/v1/wxapi/home 200）
 *   - miniprogram/ 已 npm install 且 `npm run dev:mp-weixin` 产出 dist/dev/mp-weixin
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」
 *
 * 用法：node scripts/e2e/home.auto.js
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
const HOME_API = "http://localhost:8000/api/v1/wxapi/home";

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

function fetchHome() {
  return new Promise((resolve, reject) => {
    const req = http.get(HOME_API, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          const body = JSON.parse(raw);
          if (!body || body.code !== 200 || !body.data) {
            reject(new Error(`home 接口返回异常: ${raw.slice(0, 200)}`));
            return;
          }
          resolve(body.data);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => req.destroy(new Error("home 接口超时")));
  });
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

async function runAssertions(miniProgram, homeData) {
  const page = await miniProgram.currentPage();
  assert(
    page && page.path === "pages/index/index",
    `启动应落在首页，实际 ${page && page.path}`
  );

  // [1] banner 存在 + slide 数与后端一致 + 截图
  const banner = await waitFor(page, ".home-banner");
  assert(banner, "首页应存在 banner swiper（.home-banner），加载超时或接口失败");
  const slides = await page.$$(".home-banner-slide");
  assert(
    slides.length === homeData.banners.length,
    `banner slide 数应等于后端 banners(${homeData.banners.length})，实际 ${slides.length}`
  );
  const shotPath = path.join(SHOT_DIR, "mp02-home.png");
  await miniProgram.screenshot({ path: shotPath });
  assert(fs.existsSync(shotPath), `截图未生成: ${shotPath}`);
  console.log(`[1] banner 存在（${slides.length} 张）+ 截图 → ${shotPath}`);

  // [2] 分类宫格入口数 = 7
  const cells = await page.$$(".category-cell");
  assert(
    cells.length === 7 && cells.length === homeData.categories.length,
    `分类宫格入口应=7（与后端一致），实际 ${cells.length}（后端 ${homeData.categories.length}）`
  );
  console.log("[2] 分类宫格入口数=7 通过");

  // [3] jump_type=2 的 banner → 产品列表 + 对应 category_id
  //     须在轮播首次自动切换（≈5s）前执行，保证点到的 slide 与 current 一致
  const currentIndex = Number(await banner.attribute("current")) || 0;
  const tappedBanner = homeData.banners[currentIndex];
  const slideToTap = (await page.$$(".home-banner-slide"))[currentIndex];
  assert(slideToTap, `应可取到第 ${currentIndex} 张 banner slide`);
  await slideToTap.tap();
  await sleep(1000);
  let current = await miniProgram.currentPage();
  if (tappedBanner && tappedBanner.jump_type === 2) {
    assert(
      current.path === "pages/product/list",
      `jump_type=2 banner 应跳产品列表，实际 ${current.path}`
    );
    // MP-03 起产品列表页为真实页：Pinia 传入的分类应命中左侧侧边导航的高亮项。
    const targetId = Number(tappedBanner.jump_value);
    const targetCategory = homeData.categories.find((c) => c.id === targetId);
    assert(
      targetCategory,
      `banner jump_value=${tappedBanner.jump_value} 应在 home 分类列表中可解析`
    );
    const activeSide = await waitFor(current, ".pl-side-item--active", 8000);
    assert(activeSide, "产品列表页应存在高亮的分类侧边项（.pl-side-item--active）");
    const activeText = (await activeSide.text()).trim();
    assert(
      activeText.includes(targetCategory.name),
      `侧边高亮应为「${targetCategory.name}」(category_id=${targetId})，实际「${activeText}」`
    );
    console.log(
      `[3] jump_type=2 banner 跳分类列表通过（高亮分类=${targetCategory.name}, category_id=${targetId}）`
    );
  } else {
    console.log(
      `[3] 首屏 banner jump_type=${
        tappedBanner ? tappedBanner.jump_type : "unknown"
      }（非 2），分类跳转断言跳过，落地页=${current.path}`
    );
  }
  if (current.path !== "pages/index/index") {
    await miniProgram.switchTab("/pages/index/index");
    await sleep(800);
  }

  // [4] 品牌服务横滚 + 点卡片跳资讯详情
  const serviceScroll = await page.$(".service-scroll");
  assert(serviceScroll, "应存在品牌服务横滚 scroll-view（.service-scroll）");
  const serviceCards = await page.$$(".service-card");
  assert(
    serviceCards.length === homeData.services.length && serviceCards.length >= 1,
    `服务卡片数应等于后端 services(${homeData.services.length}) 且 ≥1，实际 ${serviceCards.length}`
  );
  await serviceCards[0].tap();
  await sleep(1000);
  current = await miniProgram.currentPage();
  assert(
    current.path === "pages/article/detail",
    `点服务卡片应跳资讯详情，实际 ${current.path}`
  );
  await miniProgram.navigateBack();
  await sleep(800);
  console.log(
    `[4] 服务横滚存在（${serviceCards.length} 卡，scroll-x）+ 点卡跳详情通过`
  );

  // [5] 资讯入口跳 pages/article/list
  const entryCard = await page.$(".entry-card");
  assert(entryCard, "应存在资讯/客服入口卡片（.entry-card）");
  await entryCard.tap();
  await sleep(1000);
  current = await miniProgram.currentPage();
  assert(
    current.path === "pages/article/list",
    `点资讯入口应跳 pages/article/list，实际 ${current.path}`
  );
  await miniProgram.navigateBack();
  await sleep(800);
  console.log("[5] 资讯入口跳转通过");

  // [6] 悬浮选款按钮跳转（MP-05 未落地前回退=产品列表 tab）
  const fab = await page.$(".select-fab");
  assert(fab, "首页应存在悬浮选款按钮（.select-fab）");
  await fab.tap();
  await sleep(1000);
  current = await miniProgram.currentPage();
  assert(
    current.path === "pages/product/list",
    `悬浮按钮点击应跳转（选品页未落地前回退产品列表），实际 ${current.path}`
  );
  await miniProgram.switchTab("/pages/index/index");
  await sleep(800);
  console.log("[6] 悬浮选款按钮跳转通过（回退=产品列表 tab）");

  // [7] autoplay 5s 轮播：current 应变化（放最后，避免干扰前面按索引点 slide）
  if (homeData.banners.length > 1) {
    const swiper = await page.$(".home-banner");
    const before = await swiper.attribute("current");
    await sleep(6500);
    const after = await swiper.attribute("current");
    assert(before !== after, `banner 应 5s 自动轮播：current ${before} -> ${after}`);
    console.log(`[7] banner 自动轮播通过（current ${before} -> ${after}）`);
  } else {
    console.log("[7] seed 仅 1 张 banner，轮播断言跳过");
  }

  console.log("[done] MP-02 首页验收全部通过");
}

async function main() {
  let homeData;
  try {
    homeData = await fetchHome();
  } catch (err) {
    console.error(`[环境阻塞] 后端 ${HOME_API} 不可达：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(
    `[0] home 聚合可达：banners=${homeData.banners.length} categories=${homeData.categories.length} services=${homeData.services.length}`
  );
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
    await runAssertions(miniProgram, homeData);
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
