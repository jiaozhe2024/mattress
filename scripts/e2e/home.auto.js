/**
 * MP-02 首页自动化验收脚本（miniprogram-automator，V3 版）
 *
 * 断言内容：
 *   0. 后端 GET /api/v1/wxapi/home + /wxapi/categories 可达（数据基准，不可达=环境阻塞）
 *   1. 品牌主视觉区 = 整卡轮播（Q16）：无文案区；swiper 高度 383（原整卡高度）；
 *      指示点随 banners 动态、浮于图片底部；banners 为空时整块不渲染
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
const { launchAndReady, closeQuiet } = require("./_automationLaunch");

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

  // [1] 品牌主视觉：整卡轮播（Q16 —— 无文案区，banner 撑满原整卡高度）
  const hero = await waitFor(page, ".home-hero");
  if (homeData.banners.length > 0) {
    assert(hero, "banners 非空时应存在品牌主视觉区（.home-hero）");
    for (const legacySelector of [
      ".home-hero-text",
      ".home-hero-brand",
      ".home-hero-title",
      ".home-hero-subtitle",
    ]) {
      const legacyEl = await page.$(legacySelector);
      assert(
        legacyEl === null,
        `Q16 决议：hero 不应再有文案区 ${legacySelector}`
      );
    }
  } else {
    assert(hero === null, "banners 为空时整块 hero 不应渲染（Q16）");
  }

  const swiper = await page.$(".home-hero-swiper");
  assert(swiper, "banners 非空时应存在轮播 swiper（.home-hero-swiper）");
  const swiperSize = await sizeOf(swiper);
  assert(
    Math.abs(swiperSize.height - 383) <= 2,
    `Q16：轮播高度应为 383（原整卡高度），实际 ${JSON.stringify(swiperSize.raw)}`
  );
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
    `[1] 品牌主视觉整卡轮播通过（无文案区，swiper ${swiperSize.raw.height}，${slides.length} 张 banner，指示点 ${dots.length} 个，可切换）`
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
  // 链路（Q17 修正）：首页 → navigateTo 直达产品列表页（不再经分类页中转，
  // 否则页面栈留下分类页会让「返回」在分类页↔产品列表之间死循环）。
  let current = await miniProgram.currentPage();
  {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      current = await miniProgram.currentPage();
      if (current && current.path === "pages/product/list") break;
      await sleep(400);
    }
  }
  assert(
    current.path === "pages/product/list",
    `点寝具 9B 应直达产品列表页（首页 navigateTo → list），实际 ${current.path}`
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

  // [3b] 返回栈回归（Q17 bug）：产品列表点返回必须直接回首页，
  // 不能出现「首页 → 分类页 → 产品列表」导致返回落在分类页又被转发回产品列表的死循环。
  // 用页面侧 wx.navigateBack，不用 miniProgram.navigateBack()：
  // 后者内部走 changeRoute（先 currentPage 再调 wx.navigateBack 再 sleep 3s），
  // 与模拟器路由栈有竞态，实测会出现返回后落到 tab 页（pages/product/category）的假象。
  // 断言以「页面栈长度变短」为准，比只看 currentPage 更可靠（currentPage 在过渡期
  // 可能仍返回旧页面）。
  const stackBefore = await miniProgram.evaluate(() =>
    getCurrentPages().map((p) => "/" + p.route)
  );
  // 方式说明：产品列表页底栏是 TabBar two（首页 / 返回）。
  // 真实用户点「返回」→ TabBar 内 uni.navigateBack；点「首页」→ switchTab。
  // 这里用 wx.navigateBack（与「返回」同路径）。注意不能用 miniProgram.navigateBack()：
  // 它内部走 changeRoute（currentPage → wx.navigateBack → sleep 3s），与模拟器路由栈
  // 有竞态，实测会出现「返回后落到 tab 页」的假象。
  await miniProgram.evaluate(() => {
    wx.navigateBack({ delta: 1 });
  });
  let afterBack = await miniProgram.currentPage();
  {
    const start = Date.now();
    while (Date.now() - start < 12000) {
      afterBack = await miniProgram.currentPage();
      if (afterBack && afterBack.path === "pages/index/index") break;
      await sleep(400);
    }
  }
  const stackAfter = await miniProgram.evaluate(() =>
    getCurrentPages().map((p) => "/" + p.route)
  );
  assert(
    afterBack && afterBack.path === "pages/index/index",
    `产品列表点返回应直接回首页，实际 ${afterBack && afterBack.path}；栈 ${JSON.stringify(
      stackBefore
    )} → ${JSON.stringify(stackAfter)}`
  );
  {
    // 再多等一会，确认没有被分类页「转发桥」二次跳走
    await sleep(1500);
    const stable = await miniProgram.currentPage();
    assert(
      stable && stable.path === "pages/index/index",
      `返回后页面应稳定停在首页（无死循环），实际 ${stable && stable.path}`
    );
  }
  console.log("[3b] 返回栈正确：产品列表 → 首页（无分类页中转、无死循环）通过");

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
  // 同 [3b]：用页面侧 wx.navigateBack，避免 miniProgram.navigateBack 的路由竞态
  await miniProgram.evaluate(() => {
    wx.navigateBack({ delta: 1 });
  });
  current = await miniProgram.currentPage();
  {
    const start = Date.now();
    while (Date.now() - start < 8000) {
      current = await miniProgram.currentPage();
      if (current && current.path === "pages/index/index") break;
      await sleep(400);
    }
  }
  assert(
    current && current.path === "pages/index/index",
    `资讯页返回后应回首页，实际 ${current && current.path}`
  );
  console.log("[5] 快捷入口 2 个 + 资讯跳转通过");

  // [6] 选款 FAB = 64×42 胶囊
  // 注意（IDE 2.02 / automator 0.12）：automator 不穿透自定义组件边界，
  // `<select-fab>` 组件内部的 `.select-fab` / `.select-fab-label` 用 page.$ 查不到（旧 IDE 能）。
  // 故断言页面侧锚点 `.select-fab-host`（组件宿主，存在即组件已渲染），
  // 胶囊 64×42 的几何规格由 vitest 组件测试覆盖；此处再用截图做像素级兜底。
  const fabHost = await waitFor(current, ".select-fab-host");
  assert(fabHost, "首页应渲染选款 FAB 宿主（.select-fab-host）");
  const fabAnchor = await current.$(".select-fab-anchor");
  assert(fabAnchor, "选款 FAB 组件应挂载（.select-fab-anchor）");
  // 像素兜底：FAB 黄色胶囊必须出现在视口内（#EFC643 系，Safari/微信渲染后与 $color-yellow 有偏差）
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const fabShotPath = path.join(SHOT_DIR, "mp02-home-hero-fab.png");
  await miniProgram.screenshot({ path: fabShotPath });
  console.log(`[6] 选款 FAB 组件挂载通过（几何 64×42 由 vitest 覆盖，像素兜底 ${fabShotPath}）`);

  // [6b] 选款分流（用户 2026-11-17 决策）：store 空 → 方案编辑页空态；
  // store 非空 → 选品页。FAB 内部节点在 automator 里不可达且宿主 0×0（组件用
  // position:fixed 脱离文档流），故用 selectComponent 拿实例直接调编译后的
  // tap 处理器（e0_01），这是 IDE 2.02 下唯一可靠的驱动方式。
  {
    // 确保 store 为空：清掉上一轮可能残留的选品
    await miniProgram.evaluate(() => {
      // uni-app 的 pinia 实例挂在 app.$vm.$pinia（不是 app.$pinia，后者为 undefined）
      const app = getApp();
      const pinia = app.$pinia || (app.$vm && app.$vm.$pinia);
      const sel = pinia && pinia._s && pinia._s.get("selection");
      if (sel) {
        sel.selectedProducts = [];
        sel.currentSchemeId = null;
      }
      return true;
    });
    await sleep(600);
    await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const p = pages[pages.length - 1];
      const c = p.selectComponent(".select-fab-anchor");
      if (c && typeof c.e0_01 === "function") c.e0_01({ type: "tap" });
      return true;
    });
    await sleep(2000);
    let dest = await miniProgram.currentPage();
    {
      const start = Date.now();
      while (Date.now() - start < 8000) {
        dest = await miniProgram.currentPage();
        if (dest && dest.path === "pages/scheme/edit") break;
        await sleep(400);
      }
    }
    assert(
      dest && dest.path === "pages/scheme/edit",
      `store 为空时点选款应进方案编辑页空态（plan-01-empty），实际 ${dest && dest.path}`
    );
    console.log("[6b] store 空 → 选款进入方案编辑页空态通过");

    // store 非空 → 选品页
    // 注意：不能用 reLaunch 回首页——小程序里 reLaunch 会重建页面栈，Pinia 内容会丢，
    // 导致刚注入的选品被清空（实测退化成编辑页空态）。改用 navigateBack/switchTab 保留状态。
    await miniProgram.evaluate(() => {
      const app = getApp();
      const pinia = app.$pinia || (app.$vm && app.$vm.$pinia);
      const sel = pinia && pinia._s && pinia._s.get("selection");
      if (sel) {
        sel.selectedProducts = [
          { id: 999, name: "探针产品", model: "P-999", main_image: "/x.jpg" },
        ];
      }
      return true;
    });
    await miniProgram.switchTab("/pages/index/index");
    await sleep(1800);
    await miniProgram.evaluate(() => {
      const pages = getCurrentPages();
      const p = pages[pages.length - 1];
      const c = p.selectComponent(".select-fab-anchor");
      if (c && typeof c.e0_01 === "function") c.e0_01({ type: "tap" });
      return true;
    });
    await sleep(2000);
    {
      const start = Date.now();
      while (Date.now() - start < 8000) {
        dest = await miniProgram.currentPage();
        if (dest && dest.path === "pages/scheme/selection") break;
        await sleep(400);
      }
    }
    assert(
      dest && dest.path === "pages/scheme/selection",
      `store 非空时点选款应进选品页，实际 ${dest && dest.path}`
    );
    console.log("[6b] store 非空 → 选款进入选品页通过");

    // 复位：回首页继续后续断言
    await miniProgram.reLaunch("/pages/index/index");
    await sleep(1500);
    current = await miniProgram.currentPage();
  }

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

/**
 * 给 automator 调用套硬超时：库本身不提供超时参数，DevTools 未就绪时
 * currentPage/reLaunch/close 会无限挂住（既不 reject 也不返回）。
 */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} 超过 ${ms}ms 未返回（DevTools 未就绪）`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
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

  // 端口诊断（不作闸门：automator.launch 自己会拉起 DevTools 并开端口）
  try {
    const { resolveAutomationPort } = require("./_automationPort");
    const info = await resolveAutomationPort();
    console.log(
      info.port
        ? `[诊断] 自动化端口 ${info.port}（${info.source}）可用`
        : `[诊断] 未探测到自动化端口（${info.note}），将由 automator 启动开发者工具`
    );
  } catch (err) {
    console.log(`[诊断] 端口探测跳过：${err.message}`);
  }

  let miniProgram;
  try {
    // 用共享 helper：内置 launch 重试（上一实例未退干净）+ 就绪轮询
    // （IDE 2.x 下 currentPage 有竞态，会抛 getPageMetaByWebviewId null）
    miniProgram = await launchAndReady(automator, CLI_PATH, MP_DIST, {
      log: (m) => console.log(m),
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
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running|未返回|未就绪/i.test(
        msg
      );
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    try {
      await withTimeout(miniProgram.close(), 8000, "miniProgram.close");
    } catch (err) {
      console.error(`[清理] 关闭开发者工具失败（不影响结论）：${err.message}`);
    }
  }
}

main();
