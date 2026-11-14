/**
 * MP-02 首页自动化验收脚本（miniprogram-automator，V3 版）
 *
 * 断言内容：
 *   0. 后端 GET /api/v1/wxapi/home + /wxapi/categories 可达（数据基准，不可达=环境阻塞）
 *   1. 品牌主视觉卡存在：品牌行 / 两行标题 / 副标题；swiper 可切换（指示点随 banners 动态）
 *   2. 2×2 系列卡数=4，每卡有非空副文案（或 banner_image 图片通道）
 *   3. 寝具入口数=3（9B/9D/9P）；点击 9B → 产品列表 tab 且搜索框 keyword=9B
 *   4. 好眠服务：标题 + 服务卡数=3
 *   5. 快捷入口数=2；点击「乐卡思资讯」→ /pages/article/list
 *   6. 选款 FAB 为 64×42 胶囊（非 56rpx 圆形）
 *   7. 旧 V2 结构不存在：7 分类宫格 / 服务横滚 / 「更多系列」占位；无版本标识条
 *   8. 首页截图保存到 docs/exec-plans/screenshots/（与 references/home.png 逐区块比对）
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
const CATEGORIES_API = "http://localhost:8000/api/v1/wxapi/categories";

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

async function waitFor(page, selector, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) return el;
    await sleep(500);
  }
  return null;
}

/** 读取元素尺寸（automator 返回 width/height 字符串，可能是 px 或 rpx）。 */
async function sizeOf(element) {
  const size = await element.size();
  return {
    width: Number.parseFloat(String(size.width)),
    height: Number.parseFloat(String(size.height)),
    raw: size,
  };
}

/** 读取 swiper 当前页：优先 property，退化到 attribute。 */
async function swiperCurrent(swiper) {
  try {
    const value = await swiper.property("current");
    return Number(value);
  } catch {
    const value = await swiper.attribute("current");
    return Number(value) || 0;
  }
}

async function runAssertions(miniProgram, homeData, categoriesData) {
  const page = await miniProgram.currentPage();
  assert(
    page && page.path === "pages/index/index",
    `启动应落在首页，实际 ${page && page.path}`
  );

  // [1] 品牌主视觉卡
  const hero = await waitFor(page, ".home-hero");
  assert(hero, "首页应存在品牌主视觉卡（.home-hero），加载超时或接口失败");
  const brandText = (await page.$(".home-hero-brand")).text();
  assert(
    brandText.trim() === "LEKASI 乐卡思",
    `品牌行应为「LEKASI 乐卡思」，实际「${brandText}」`
  );
  const titleLines = await page.$$(".home-hero-title");
  const titleTexts = [];
  for (const line of titleLines) titleTexts.push((await line.text()).trim());
  assert(
    titleTexts.join("") === "把舒适，带回每一个夜晚",
    `主标题两行应为「把舒适，/带回每一个夜晚」，实际 ${JSON.stringify(titleTexts)}`
  );
  const subtitleText = (await page.$(".home-hero-subtitle")).text();
  assert(
    subtitleText.trim() === "探索适合自己与家人的好眠选择",
    `副标题文案不符，实际「${subtitleText}」`
  );

  const swiper = await page.$(".home-hero-swiper");
  assert(swiper, "banners 非空时应存在轮播 swiper（.home-hero-swiper）");
  const slides = await page.$$(".home-hero-slide");
  assert(
    slides.length === homeData.banners.length,
    `banner slide 数应等于后端 banners(${homeData.banners.length})，实际 ${slides.length}`
  );
  const dots = await page.$$(".home-hero-dot");
  const expectedDots = homeData.banners.length > 1 ? homeData.banners.length : 0;
  assert(
    dots.length === expectedDots,
    `轮播指示点应=${expectedDots}（仅 1 张时隐藏），实际 ${dots.length}`
  );

  // swiper 可切换：主动 swipeTo 到第 2 页（无自动播放依赖），校验 current 变化
  if (homeData.banners.length > 1) {
    const before = await swiperCurrent(swiper);
    let switched = false;
    try {
      await swiper.swipeTo(1);
      await sleep(600);
      switched = (await swiperCurrent(swiper)) === 1;
    } catch {
      // swipeTo 不可用时退化为等待 autoplay（5s）
      await sleep(6000);
      switched = (await swiperCurrent(swiper)) !== before;
    }
    assert(switched, `轮播应可切换（swipeTo(1) 后 current 未变为 1）`);
  }
  console.log(
    `[1] 品牌主视觉卡通过（${slides.length} 张 banner，指示点 ${dots.length} 个，swiper 可切换）`
  );

  // [2] 2×2 系列卡 = 4，副文案非空（或图片通道）
  const seriesCards = await page.$$(".home-series-card");
  assert(
    seriesCards.length === 4,
    `系列卡应=4（8 分类取 sort 前 4），实际 ${seriesCards.length}`
  );
  for (let i = 0; i < seriesCards.length; i += 1) {
    const card = seriesCards[i];
    const hasImage = (await card.$(".home-series-image")) !== null;
    const subtitleEl = await card.$(".home-series-subtitle");
    if (!hasImage) {
      assert(
        subtitleEl !== null,
        `第 ${i + 1} 张系列卡既无 banner_image 也无副文案（.home-series-subtitle）`
      );
      const subtitle = (await subtitleEl.text()).trim();
      assert(subtitle !== "", `第 ${i + 1} 张系列卡副文案为空`);
    }
  }
  assert(
    categoriesData.length >= 4,
    `后端分类数应≥4，实际 ${categoriesData.length}`
  );
  console.log(`[2] 系列卡 4 张（副文案非空或图片通道）通过`);

  // [3] 寝具入口 = 3；点 9B → 产品页 keyword=9B
  const beddingCards = await page.$$(".home-bedding-card");
  assert(beddingCards.length === 3, `寝具入口应=3，实际 ${beddingCards.length}`);
  const models = await page.$$(".home-bedding-model");
  const modelTexts = [];
  for (const model of models) modelTexts.push((await model.text()).trim());
  assert(
    modelTexts.join(",") === "9B,9D,9P",
    `寝具型号应为 9B/9D/9P，实际 ${JSON.stringify(modelTexts)}`
  );
  await beddingCards[0].tap();
  await sleep(1200);
  let current = await miniProgram.currentPage();
  assert(
    current.path === "pages/product/list",
    `点寝具 9B 应 switchTab 产品列表，实际 ${current.path}`
  );
  const searchInput = await waitFor(current, ".pl-search-input", 8000);
  assert(searchInput, "产品列表页应存在搜索框（.pl-search-input）");
  let keywordValue = "";
  try {
    keywordValue = String(await searchInput.value());
  } catch {
    keywordValue = String(await searchInput.attribute("value"));
  }
  assert(
    keywordValue.trim() === "9B",
    `产品页搜索框应回填 keyword=9B，实际「${keywordValue}」`
  );
  console.log("[3] 寝具入口 3 个 + 点 9B 进入产品页 keyword=9B 通过");

  await miniProgram.switchTab("/pages/index/index");
  await sleep(1000);
  const homeAgain = await miniProgram.currentPage();
  assert(
    homeAgain && homeAgain.path === "pages/index/index",
    `应回到首页，实际 ${homeAgain && homeAgain.path}`
  );

  // [4] 好眠服务：标题 + 3 张卡
  const serviceTitle = await waitFor(homeAgain, ".home-services-title");
  assert(serviceTitle, "应存在「乐卡思 · 好眠服务」标题");
  assert(
    (await serviceTitle.text()).trim() === "乐卡思 · 好眠服务",
    `服务标题不符，实际「${await serviceTitle.text()}」`
  );
  const serviceCards = await homeAgain.$$(".home-service-card");
  assert(serviceCards.length === 3, `服务卡应=3，实际 ${serviceCards.length}`);
  console.log("[4] 好眠服务标题 + 3 张服务卡通过");

  // [5] 快捷入口 = 2；资讯 → /pages/article/list
  const entryCards = await homeAgain.$$(".home-entry-card");
  assert(entryCards.length === 2, `快捷入口应=2，实际 ${entryCards.length}`);
  const entryLabels = await homeAgain.$$(".home-entry-label");
  const labelTexts = [];
  for (const label of entryLabels) labelTexts.push((await label.text()).trim());
  assert(
    labelTexts.join(",") === "乐卡思资讯,联系客服",
    `快捷入口文案不符，实际 ${JSON.stringify(labelTexts)}`
  );
  await entryCards[0].tap();
  await sleep(1200);
  current = await miniProgram.currentPage();
  assert(
    current.path === "pages/article/list",
    `点「乐卡思资讯」应跳 /pages/article/list，实际 ${current.path}`
  );
  await miniProgram.navigateBack();
  await sleep(1000);
  current = await miniProgram.currentPage();
  assert(
    current && current.path === "pages/index/index",
    `资讯页返回后应回首页，实际 ${current && current.path}`
  );
  console.log("[5] 快捷入口 2 个 + 资讯跳转通过");

  // [6] 选款 FAB = 64×42 胶囊
  const fab = await waitFor(current, ".select-fab");
  assert(fab, "首页应存在选款 FAB（.select-fab）");
  const fabSize = await sizeOf(fab);
  const fabStyle = await fab.style("border-radius");
  assert(
    Math.abs(fabSize.width - 64) <= 1 && Math.abs(fabSize.height - 42) <= 1,
    `FAB 尺寸应为 64×42，实际 ${JSON.stringify(fabSize.raw)}`
  );
  assert(
    String(fabStyle) !== "50%" && String(fabStyle) !== "9999px",
    `FAB 应为圆角 20 的胶囊而非圆形，实际 border-radius=${fabStyle}`
  );
  const fabLabel = await fab.$(".select-fab-label");
  assert(fabLabel, "FAB 应含「选款」文字（.select-fab-label）");
  assert((await fabLabel.text()).trim() === "选款", "FAB 文字应为「选款」");
  console.log(`[6] 选款 FAB 胶囊 64×42 通过（${JSON.stringify(fabSize.raw)}）`);

  // [7] 旧 V2 结构 / 版本条不存在
  const legacy = [".category-grid", ".category-cell", ".category-more", ".service-scroll"];
  for (const selector of legacy) {
    const el = await current.$(selector);
    assert(el === null, `首页不应再有旧 V2 结构 ${selector}`);
  }
  const versionBar = await current.$(".version-bar");
  assert(versionBar === null, "首页不应有版本标识条（.version-bar，Q12）");
  console.log("[7] 无 7 分类宫格 / 无服务横滚 / 无「更多系列」/ 无版本条通过");

  // [8] 截图
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const shotPath = path.join(SHOT_DIR, "mp02-home.png");
  await miniProgram.screenshot({ path: shotPath });
  assert(fs.existsSync(shotPath), `截图未生成: ${shotPath}`);
  console.log(`[8] 首页截图 → ${shotPath}`);

  console.log("[done] MP-02 首页 V3 验收全部通过");
}

async function main() {
  let homeData;
  let categoriesData;
  try {
    homeData = await fetchJson(HOME_API);
    categoriesData = await fetchJson(CATEGORIES_API);
  } catch (err) {
    console.error(`[环境阻塞] 后端接口不可达：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(
    `[0] 接口可达：banners=${homeData.banners.length} categories=${categoriesData.length}`
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
    await runAssertions(miniProgram, homeData, categoriesData);
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
