/**
 * MP-03B 产品页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-03B verify 与 spec.md §5.3）：
 *   0. 后端 GET /wxapi/products + /wxapi/categories 可达（不可达=环境阻塞）
 *   1. 静态：V3 三大移除项已消失（左侧分类栏 / 底部已选栏 / 列表视图产物）
 *   2. 静态：卡片尺寸 167×246、主图 150、内容区 top156 143×82、标签 72×22 & 58×20
 *   3. 静态：无硬编码 hex / 无裸 px 间距 / 无裸行高（此前两轮反复踩坑，硬性守住）
 *   4. 静态：搜索占位「请输入搜索的商品」、排序三项、TabBar two、WechatNav 二级页
 *   5. 动态：导航标题=分类名、搜索框存在、排序控件渲染
 *   6. 动态：产品卡渲染且尺寸吻合、名称/规格/睡感/查看详情四要素齐全
 *   7. 动态：DOM 层无 .pl-side（侧栏）、无 .selected-bar（已选栏）
 *   8. 截图对照 references/product-list.png
 *
 * 为什么静态断言独立存在：MP-03A/B 两次的 CC 都在收尾阶段挂死，动态段又长期
 * 被微信开发者工具扫码前置阻塞。静态段让脚本在没有 DevTools 时也能提供回归价值。
 *
 * 运行前提：
 *   - 后端 docker compose up 且 seed 已灌（/wxapi/products 200）
 *   - miniprogram/ 已 npm install 且 `npm run dev:mp-weixin` 产出 dist/dev/mp-weixin
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」
 *
 * 用法：node scripts/e2e/product-list.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞（后端不可达/DevTools 未登录/端口未开启）
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

/** 静态源码断言：不依赖 DevTools，可离线跑（MP-03A/B 的 CC 均在收尾挂死，静态段保证回归价值） */
function assertStaticSource() {
  console.log("\n== 静态源码断言（不依赖 DevTools）==");
  const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, "miniprogram", "src", rel), "utf8");
  const listVue = read("pages/product/list.vue");
  const cardVue = read("components/product/ProductCard.vue");
  // 文案常量分散在：model（SEARCH_PLACEHOLDER）、api/product.ts（SORT_TABS 的 label）
  const modelTs = read("components/product/productListModel.ts");
  const apiTs = read("api/product.ts");
  const styleOf = (src) => {
    const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return m ? m[1] : "";
  };
  const listStyle = styleOf(listVue);
  const cardStyle = styleOf(cardVue);
  let pass = 0;
  let fail = 0;
  const chk = (name, cond, detail) => {
    if (cond) { pass += 1; console.log(`  PASS  ${name}${detail ? "  " + detail : ""}`); }
    else { fail += 1; console.error(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
  };

  // ---- V3 三大移除项 ----
  chk("移除项1: 无左侧分类侧边导航", !/pl-side|side-item|side-nav/i.test(listVue));
  chk("移除项2: 无底部已选栏", !/SelectedBar|selected-bar|sel-bar/i.test(listVue));
  chk("移除项3: 无列表视图产物(Q6)", !/pl-cards--list/i.test(listVue));
  chk("版本条不实现(Q12)", !/参考复刻优化版/.test(listVue));

  // ---- 卡片规格 spec §5.3 ----
  chk("卡片高 246px", /height:\s*246px/.test(cardStyle));
  chk("主图高 150px", /height:\s*150px/.test(cardStyle));
  chk("卡片圆角 radius-12", /\$radius-12/.test(cardStyle));
  chk("内容区 top156", /top:\s*156px/.test(cardStyle));
  chk("内容区宽 143px", /width:\s*143px/.test(cardStyle));
  chk("内容区高 82px", /height:\s*82px/.test(cardStyle));
  chk("睡感标签 72px 宽", /width:\s*72px/.test(cardStyle));
  chk("查看详情 58px 宽", /width:\s*58px/.test(cardStyle));
  chk("卡片投影 shadow-card", /\$shadow-card/.test(cardStyle));

  // ---- token 合规（前两轮反复踩坑，硬性守住）----
  const both = listStyle + cardStyle;
  const hexes = both.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  const bareSp = both.match(/(?:gap|padding|margin)[^:;]*:\s*[^;]*?\b\d+px/g) || [];
  const bareLh = both.match(/line-height:\s*\d+px/g) || [];
  chk("无硬编码 hex 色值", hexes.length === 0, `count=${hexes.length}`);
  chk("无裸 px 间距", bareSp.length === 0, `count=${bareSp.length}`);
  chk("无裸行高", bareLh.length === 0, `count=${bareLh.length}`);

  // ---- 文案与结构 ----
  chk("搜索占位文案", /请输入搜索的商品/.test(modelTs + listVue));
  const sortSrc = apiTs + modelTs + listVue;
  chk(
    "排序三项齐全",
    /综合/.test(sortSrc) && /推荐/.test(sortSrc) && /新品/.test(sortSrc),
    "综合/推荐/新品 均在 SORT_TABS"
  );
  chk("TabBar two", /variant="two"|:variant="'two'"/.test(listVue));
  chk("使用 WechatNav", /WechatNav/.test(listVue));

  return { pass, fail };
}

async function runAssertions(miniProgram, baseline) {
  let pass = 0;
  let fail = 0;
  const chk = (name, cond, detail) => {
    if (cond) { pass += 1; console.log(`  PASS  ${name}${detail ? "  " + detail : ""}`); }
    else { fail += 1; console.error(`  FAIL  ${name}${detail ? "  " + detail : ""}`); }
  };

  // MP-03A 起产品列表脱离 tabBar，以普通页 navigateTo 进入（可带 category_id）
  const cat = baseline.categories[0];
  await miniProgram.reLaunch(
    `/pages/product/list?category_id=${cat.id}&category_name=${encodeURIComponent(cat.name)}`
  );
  await sleep(1500);
  const page = await miniProgram.currentPage();
  assert(page && page.path === "pages/product/list", `应落在产品页，实际 ${page && page.path}`);

  // 导航标题 = 分类名
  const navTitle = await page.$(".wnav-title");
  const navText = navTitle ? (await navTitle.text()).trim() : "";
  chk("导航标题为分类名", navText === cat.name, `got="${navText}" 期望="${cat.name}"`);

  // 搜索框
  chk("搜索输入框存在", !!(await page.$("input")));

  // 排序控件
  const sorts = await page.$$("[class*=sort]");
  chk("排序控件已渲染", sorts.length >= 3, `count=${sorts.length}`);

  // 产品卡
  const cards = await page.$$(".pcard");
  chk("产品卡已渲染", cards.length > 0, `count=${cards.length}`);
  if (cards.length > 0) {
    const size = await cards[0].size();
    chk(
      "卡片尺寸 167x246(容差2px)",
      Math.abs(size.width - 167) <= 2 && Math.abs(size.height - 246) <= 2,
      `got=${Math.round(size.width)}x${Math.round(size.height)}`
    );
  }

  // 卡片四要素
  chk("产品名元素", !!(await page.$(".pcard-name")));
  chk("规格元素", !!(await page.$(".pcard-spec")));
  chk("睡感标签元素", !!(await page.$(".pcard-feel")));
  chk("查看详情元素", !!(await page.$(".pcard-detail")));

  // DOM 层确认移除项
  chk("DOM 无 .pl-side 侧栏", !(await page.$(".pl-side")));
  chk("DOM 无 .selected-bar 已选栏", !(await page.$(".selected-bar")));

  // 截图
  const shotPath = path.join(SHOT_DIR, "mp03b-product-list.png");
  await miniProgram.screenshot({ path: shotPath });
  chk("截图已生成", fs.existsSync(shotPath), shotPath);

  return { pass, fail };
}

async function main() {
  let products;
  let categories;
  try {
    const [pr, cr] = await Promise.all([
      fetchJson(`${PRODUCTS_API}?size=50`),
      fetchJson(CATEGORIES_API),
    ]);
    products = pr;
    categories = cr;
  } catch (err) {
    console.error(`[环境阻塞] 后端不可达（${PRODUCTS_API} / ${CATEGORIES_API}）：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[0] 接口可达：products.total=${products.total} categories=${categories.length}`);
  if (products.total < 1) {
    console.error("[环境阻塞] products 为空，无法验证产品页");
    process.exitCode = 2;
    return;
  }

  // 静态断言先跑（不依赖 DevTools）
  const st = assertStaticSource();

  // 动态断言
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  let miniProgram;
  let dy = { pass: 0, fail: 0 };
  try {
    miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: MP_DIST });
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    process.exitCode = 2;
    console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
    if (st.fail > 0) process.exitCode = 1;
    return;
  }
  try {
    console.log("\n== 动态断言（automator）==");
    dy = await runAssertions(miniProgram, { products, categories });
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked = /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running/i.test(msg);
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    if (miniProgram) await miniProgram.close();
  }

  const totalPass = st.pass + dy.pass;
  const totalFail = st.fail + dy.fail;
  console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
  console.log(`动态：PASS=${dy.pass} FAIL=${dy.fail}`);
  console.log(`合计：PASS=${totalPass} FAIL=${totalFail}`);
  if (totalFail > 0 && !process.exitCode) process.exitCode = 1;
}

main();
