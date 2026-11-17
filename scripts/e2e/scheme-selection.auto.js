/**
 * MP-05A 选品页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-05A verify 与 spec.md §5.6）：
 *   1. 静态：左分类栏宽 94、当前分类左侧 3×16 指示条、右栏两列 calc 卡宽
 *   2. 静态：产品名 10px、规格 8px、标签 8px（Q11 取整，无 9.88/7.6）
 *   3. 静态：+ / ✓ 透明热区 44×44 且视觉 21×21（Q13）
 *   4. 静态：无版本标识条（Q12）/ 无硬编码 hex / 无裸 px 间距 / 无裸行高
 *   5. 静态：pages.json 注册（custom）+ config.SELECTION_PAGE 指向真实页
 *   6. 动态：左栏分类渲染、首项选中、产品卡两列、点 + → ✓ 且计数 +1、
 *      再点 → + 且计数 -1、点缩略图 × 移除、点 OK 跳方案编辑页并保留选品
 *   7. 截图存档，供与 references/plan-02-picker.png 逐区块比对
 *
 * 为什么静态断言独立存在：MP-03A/B/04 的动态段长期被微信开发者工具扫码前置阻塞，
 * 静态段让脚本在没有 DevTools 时也能提供回归价值。
 *
 * 运行前提：
 *   - 后端 docker compose up 且 seed 已灌（/wxapi/products、/wxapi/categories 200）
 *   - miniprogram/ 已 npm install 且 `npm run dev:mp-weixin` 产出 dist/dev/mp-weixin
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」
 *
 * 用法：node scripts/e2e/scheme-selection.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞（后端不可达/DevTools 未登录/端口未开启）
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MP_DIST = path.join(REPO_ROOT, "miniprogram", "dist", "dev", "mp-weixin");
const SHOT_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "screenshots");
const CLI_PATH = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const API_BASE = "http://localhost:8000/api/v1";
const PRODUCTS_API = `${API_BASE}/wxapi/products`;
const CATEGORIES_API = `${API_BASE}/wxapi/categories`;
const PAGE_PATH = "pages/scheme/selection";
const LAUNCH_TIMEOUT_MS = 45000;
const WATCHDOG_TIMEOUT_MS = 240000;
const { resolveAutomationPort } = require("./_automationPort");
const { launchAndReady, closeQuiet, navInfo, sleep: sleepShared, withTimeout: withTimeoutShared } = require("./_automationLaunch");

/**
 * 预检 DevTools 自动化端口。
 *
 * 为什么必须预检：`automator.launch` 在「服务端口未开启」时会同步 spawn CLI 并
 * 无限等待，整个 node 事件循环被阻塞 —— 定时器看门狗也救不回来（MP-03A/B 两次
 * 收尾挂死同源）。先做 TCP 探测，未开启即按环境阻塞退出，绝不挂死、绝不伪造。
 */
/**
 * 解析 DevTools 自动化端口（自动探测）。
 * 端口号由开发者工具首次启动随机分配并写入本地配置，
 * 硬编码会在别的机器上误判成「服务端口没开」。
 */
async function checkAutomationPort() {
  const resolved = await resolveAutomationPort();
  return { ok: resolved.port !== null, ...resolved };
}

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

/** Promise 超时包装：automator 的 RPC 在 DevTools 卡死时不会 reject。 */
function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} 超时 ${timeoutMs}ms（DevTools 无响应/端口未开）`));
      }, timeoutMs);
      timer.unref?.();
    }),
  ]);
}

async function waitForText(page, selector, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = await page.$(selector);
    if (el) {
      const text = (await el.text()).trim();
      if (text !== "") return text;
    }
    await sleep(400);
  }
  return "";
}

/**
 * 静态源码断言：不依赖 DevTools，可离线跑。
 * CSS 注释先剥离：注释允许引用原稿中间值（如「不硬编码 126.92px」）。
 */
function assertStaticSource() {
  console.log("\n== 静态源码断言（不依赖 DevTools）==");
  const read = (rel) =>
    fs.readFileSync(path.join(REPO_ROOT, "miniprogram", "src", rel), "utf8");
  const pageVue = read("pages/scheme/selection.vue");
  const modelTs = read("components/scheme/schemeSelectionModel.ts");
  const configTs = read("config.ts");
  const pagesJson = JSON.parse(read("pages.json"));

  const styleRaw = (() => {
    const m = pageVue.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return m ? m[1] : "";
  })();
  const style = styleRaw.replace(/\/\*[\s\S]*?\*\//g, "");

  let pass = 0;
  let fail = 0;
  const chk = (name, cond, detail) => {
    if (cond) {
      pass += 1;
      console.log(`  PASS  ${name}${detail ? "  " + detail : ""}`);
    } else {
      fail += 1;
      console.error(`  FAIL  ${name}${detail ? "  " + detail : ""}`);
    }
  };

  // ---- 注册与路由 ----
  const entry = (pagesJson.pages || []).find((p) => p.path === PAGE_PATH);
  chk("pages.json 注册选品页", !!entry);
  chk("navigationStyle=custom", entry && entry.style && entry.style.navigationStyle === "custom");
  chk(
    "navigationBarTitleText=LEKASI 乐卡思",
    entry && entry.style && entry.style.navigationBarTitleText === "LEKASI 乐卡思"
  );
  chk(
    "config.SELECTION_PAGE 指向真实页",
    /export const SELECTION_PAGE = "\/pages\/scheme\/selection";/.test(configTs)
  );

  // ---- 导航与搜索（spec §5.6 ①）----
  chk("使用 WechatNav 且为二级页(back)", /<WechatNav[^>]*\bback\b/.test(pageVue));
  chk("导航标题常量", /SELECTION_NAV_TITLE = "LEKASI 乐卡思"/.test(modelTs));
  chk("搜索占位「输入型号搜索」", /SELECTION_SEARCH_PLACEHOLDER = "输入型号搜索"/.test(modelTs));
  chk("搜索框 327×36 圆角 18", /\.ss-search-box\s*\{[\s\S]*?width:\s*327px;[\s\S]*?height:\s*36px;[\s\S]*?border-radius:\s*\$radius-18;/.test(style));
  chk("搜索图标 16×16 left14 top10", /\.ss-search-icon\s*\{[\s\S]*?top:\s*\$space-10;[\s\S]*?left:\s*14px;[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/.test(style));

  // ---- ② 左分类栏 ----
  chk("左分类栏宽 94", /\.ss-cats\s*\{[\s\S]*?width:\s*94px;/.test(style));
  chk("分类项 h56 px8", /\.ss-cat-item\s*\{[\s\S]*?height:\s*56px;[\s\S]*?padding:\s*0 \$space-8;/.test(style));
  chk("激活项白底", /\.ss-cat-item--active\s*\{[\s\S]*?background-color:\s*\$color-text-inv;/.test(style));
  chk(
    "左侧指示条 3×16 yellow top20",
    /\.ss-cat-indicator\s*\{[\s\S]*?top:\s*\$space-20;[\s\S]*?width:\s*3px;[\s\S]*?height:\s*16px;[\s\S]*?background-color:\s*\$color-yellow;/.test(style)
  );

  // ---- Q10 自适应两列 ----
  chk(
    "Q10 卡宽 calc((100% - gap)/2)，非 126.92px",
    /width:\s*calc\(\(100% - #\{\$space-8\}\) \/ 2\);/.test(style) && !style.includes("126.92")
  );
  chk("两列 column-gap $space-8", /column-gap:\s*\$space-8;/.test(style));
  chk("产品卡圆角 12 + shadow/card", /\.ss-card\s*\{[\s\S]*?border-radius:\s*\$radius-12;[\s\S]*?box-shadow:\s*\$shadow-card;/.test(style));
  chk("主图 114 高", /\.ss-card-media\s*\{[\s\S]*?height:\s*114px;/.test(style));
  chk("内容区 left9 top119", /\.ss-card-info\s*\{[\s\S]*?top:\s*119px;[\s\S]*?left:\s*\$space-9;/.test(style));

  // ---- Q11 字号取整 ----
  chk("Q11 产品名 10px", /\.ss-card-name\s*\{[\s\S]*?font-size:\s*\$font-10;/.test(style));
  chk(
    "Q11 规格/两个标签均 8px（共 3 处）",
    (style.match(/font-size:\s*8px;/g) || []).length === 3
  );
  chk("Q11 无 9.88 / 7.6 / 8.36 中间值", !/9\.88|7\.6\b|8\.36/.test(style));
  chk("睡感标签圆角 8 + yellowSoft", /\.ss-card-feel\s*\{[\s\S]*?border-radius:\s*\$radius-8;[\s\S]*?background-color:\s*\$color-yellow-soft;/.test(style));
  chk("查看详情圆角 3 + fill", /\.ss-card-detail\s*\{[\s\S]*?border-radius:\s*3px;[\s\S]*?background-color:\s*\$color-fill;/.test(style));

  // ---- Q13 热区 ----
  chk(
    "Q13 操作钮透明热区 44×44",
    /\.ss-card-action\s*\{[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px;/.test(style)
  );
  chk(
    "Q13 视觉按钮 21×21 圆角 11",
    /\.ss-card-action-btn\s*\{[\s\S]*?width:\s*21px;[\s\S]*?height:\s*21px;[\s\S]*?border-radius:\s*\$radius-11;/.test(style)
  );
  chk("未选态 yellow + navy", /\.ss-card-action-btn\s*\{[\s\S]*?background-color:\s*\$color-yellow;/.test(style) && /\.ss-card-action-icon\s*\{[\s\S]*?color:\s*\$color-navy;/.test(style));
  chk("已选态 line + text3", /\.ss-card-action--selected \.ss-card-action-btn\s*\{[\s\S]*?background-color:\s*\$color-line;/.test(style) && /\.ss-card-action--selected \.ss-card-action-icon\s*\{[\s\S]*?color:\s*\$color-text-3;/.test(style));

  // ---- ③ 已选栏 ----
  chk("已选栏 bg navy p12 gap10", /\.ss-selected-bar\s*\{[\s\S]*?gap:\s*\$space-10;[\s\S]*?padding:\s*\$space-12;[\s\S]*?background-color:\s*\$color-navy;/.test(style));
  chk("缩略图 49×55 圆角 4 cream", /\.ss-thumb\s*\{[\s\S]*?width:\s*49px;[\s\S]*?height:\s*55px;[\s\S]*?border-radius:\s*\$radius-4;[\s\S]*?background-color:\s*\$color-cream;/.test(style));
  chk("缩略图产品图 49×38", /\.ss-thumb-image\s*\{[\s\S]*?width:\s*49px;[\s\S]*?height:\s*38px;/.test(style));
  chk("OK 90×42 圆角 20 yellow", /\.ss-ok\s*\{[\s\S]*?width:\s*90px;[\s\S]*?height:\s*42px;[\s\S]*?border-radius:\s*\$radius-20;[\s\S]*?background-color:\s*\$color-yellow;/.test(style));
  chk("已选文案「已选：N」", /SELECTED_COUNT_PREFIX = "已选："/.test(modelTs));
  chk("OK 文案", /OK_LABEL = "OK"/.test(modelTs));

  // ---- token 合规 ----
  const hexes = style.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  const bareSp = style.match(/(?:gap|padding|margin)[^:;]*:\s*[^;]*?\b\d+px/g) || [];
  const bareLh = style.match(/line-height:\s*\d+px/g) || [];
  chk("无硬编码 hex 色值", hexes.length === 0, `count=${hexes.length}`);
  chk("无裸 px 间距", bareSp.length === 0, `count=${bareSp.length}`);
  chk("无裸行高", bareLh.length === 0, `count=${bareLh.length}`);

  // ---- 核心约定 9 / Q12 ----
  chk("选品走 useSelectionStore", /useSelectionStore/.test(pageVue));
  chk("不使用 setStorageSync 传参", !/setStorageSync/.test(pageVue));
  chk("Q12 无版本标识条", !/参考复刻优化版/.test(pageVue) && !/version-bar/.test(pageVue));

  return { pass, fail };
}

async function readCount(page) {
  const text = await waitForText(page, ".ss-count", 8000);
  const match = /已选：\s*(\d+)/.exec(text);
  return match ? Number(match[1]) : -1;
}

async function runAssertions(miniProgram) {
  let pass = 0;
  let fail = 0;
  const chk = (name, cond, detail) => {
    if (cond) {
      pass += 1;
      console.log(`  PASS  ${name}${detail ? "  " + detail : ""}`);
    } else {
      fail += 1;
      console.error(`  FAIL  ${name}${detail ? "  " + detail : ""}`);
    }
  };

  await miniProgram.reLaunch(`/${PAGE_PATH}`);
  await sleep(2000);
  const page = await miniProgram.currentPage();
  assert(page && page.path === PAGE_PATH, `应落在选品页，实际 ${page && page.path}`);

  // 导航（组件内部节点不可达，读宿主 data-* 属性）
  const nav = await navInfo(page);
  chk("导航标题 LEKASI 乐卡思", nav.title === "LEKASI 乐卡思", `got="${nav.title}"`);
  chk("二级页返回箭头", nav.back === true);

  // 分类栏
  const cats = await page.$$(".ss-cat-item");
  chk("左分类栏已渲染", cats.length > 0, `count=${cats.length}`);
  const catBox = await (await page.$(".ss-cats")).size();
  chk("左分类栏宽 94(容差2)", Math.abs(catBox.width - 94) <= 2, `got=${Math.round(catBox.width)}`);
  chk("当前分类有 3×16 指示条", !!(await page.$(".ss-cat-indicator")));
  const indicator = await (await page.$(".ss-cat-indicator")).size();
  chk(
    "指示条尺寸 3×16(容差1)",
    Math.abs(indicator.width - 3) <= 1 && Math.abs(indicator.height - 16) <= 1,
    `got=${indicator.width}x${indicator.height}`
  );

  // 产品卡
  const cards = await page.$$(".ss-card");
  chk("产品卡已渲染", cards.length > 0, `count=${cards.length}`);
  if (cards.length >= 2) {
    const [a, b] = await Promise.all([cards[0].size(), cards[1].size()]);
    chk(
      "两列网格：同高、宽接近、横向并排",
      Math.abs(a.height - b.height) <= 2 && Math.abs(a.width - b.width) <= 2 && a.width > 80,
      `${Math.round(a.width)}x${Math.round(a.height)} / ${Math.round(b.width)}x${Math.round(b.height)}`
    );
  }

  // Q13 热区
  const action = await page.$(".ss-card-action");
  if (action) {
    const box = await action.size();
    chk(
      "Q13 操作钮热区 ≥44×44",
      box.width >= 44 && box.height >= 44,
      `got=${Math.round(box.width)}x${Math.round(box.height)}`
    );
  } else {
    chk("Q13 操作钮热区 ≥44×44", false, "未找到 .ss-card-action");
  }

  // ---- 选品交互 ----
  const baseCount = await readCount(page);
  chk("初始计数可读", baseCount >= 0, `got=${baseCount}`);

  const firstAction = await page.$(".ss-card-action");
  const beforeIcon = ((await (await firstAction.$(".ss-card-action-icon")).text()) || "").trim();
  await firstAction.tap();
  await sleep(600);
  const afterAdd = await readCount(page);
  const addedIcon = ((await (await (await page.$(".ss-card-action")).$(".ss-card-action-icon")).text()) || "").trim();
  chk("点 + 后按钮变 ✓", addedIcon === "✓", `before="${beforeIcon}" after="${addedIcon}"`);
  chk("点 + 后计数 +1", afterAdd === baseCount + 1, `${baseCount} → ${afterAdd}`);
  chk("选品后出现可移除缩略图", !!(await page.$(".ss-thumb")));

  await (await page.$(".ss-card-action")).tap();
  await sleep(600);
  const afterRemove = await readCount(page);
  const removedIcon = ((await (await (await page.$(".ss-card-action")).$(".ss-card-action-icon")).text()) || "").trim();
  chk("再点 ✓ 后按钮变回 +", removedIcon === "+", `got="${removedIcon}"`);
  chk("再点 ✓ 后计数 -1", afterRemove === baseCount, `${afterAdd} → ${afterRemove}`);

  // 加两件，点缩略图 × 移除
  const actions = await page.$$(".ss-card-action");
  if (actions.length >= 2) {
    await actions[0].tap();
    await sleep(400);
    await (await page.$$(".ss-card-action"))[1].tap();
    await sleep(600);
    chk("已选两件后缩略图 2 个", (await page.$$(".ss-thumb")).length === 2);
    await (await page.$(".ss-thumb")).tap();
    await sleep(600);
    chk("点缩略图 × 移除 1 件", (await readCount(page)) === baseCount + 1);
  }

  // 点 OK → 方案编辑页（MP-05B 未落地时 toast 兜底，选品保留）
  const selectedBeforeOk = await readCount(page);
  await (await page.$(".ss-ok")).tap();
  await sleep(1200);
  const afterOk = await miniProgram.currentPage();
  const navigated = afterOk && afterOk.path === "pages/scheme/edit";
  if (!navigated) {
    console.log("  INFO  方案编辑页未落地（MP-05B），OK 走 toast 兜底");
    await miniProgram.reLaunch(`/${PAGE_PATH}`);
    await sleep(1500);
    const back = await miniProgram.currentPage();
    const kept = await readCount(back);
    chk(
      "OK 兜底后选品保留在 Pinia",
      kept === selectedBeforeOk,
      `before=${selectedBeforeOk} after=${kept}`
    );
  } else {
    chk("OK 跳转方案编辑页", true, afterOk.path);
  }

  // 截图
  const shotPath = path.join(SHOT_DIR, "mp05a-scheme-selection.png");
  if ((await miniProgram.currentPage()).path !== PAGE_PATH) {
    await miniProgram.reLaunch(`/${PAGE_PATH}`);
    await sleep(1500);
  }
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
  console.log(
    `[0] 接口可达：products.total=${products.total} categories=${categories.length}`
  );
  if (products.total < 1 || categories.length < 1) {
    console.error("[环境阻塞] 产品/分类数据为空，无法验证选品页");
    process.exitCode = 2;
    return;
  }

  const st = assertStaticSource();

  // 预检 DevTools 自动化端口：未开启时 automator.launch 会阻塞事件循环导致挂死，
  // 必须在 launch 之前按环境阻塞退出（静态段结果仍然有效）。
  // 端口预检仅作诊断，不阻断：automator.launch 会自行启动 DevTools 并开服务端口，
  // 此刻端口没监听是正常的（DevTools 尚未运行）。
  const portState = await checkAutomationPort();
  if (!portState.ok) {
    console.log(
      `[诊断] 当前未检测到 DevTools 自动化端口（${portState.note || "未监听"}），` +
        `将由 automator 启动开发者工具。`
    );
  }
fs.mkdirSync(SHOT_DIR, { recursive: true });
  let miniProgram;
  let dy = { pass: 0, fail: 0 };
  try {
    miniProgram = await withTimeout(
      launchAndReady(automator, CLI_PATH, MP_DIST),
      LAUNCH_TIMEOUT_MS,
      "automator.launch"
    );
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    process.exitCode = 2;
    console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
    if (st.fail > 0) process.exitCode = 1;
    return;
  }
  try {
    console.log("\n== 动态断言（automator）==");
    dy = await withTimeout(runAssertions(miniProgram), WATCHDOG_TIMEOUT_MS - 30000, "动态断言段");
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked = /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running|超时/i.test(msg);
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    if (miniProgram) {
      await closeQuiet(miniProgram);
    }
  }

  const totalPass = st.pass + dy.pass;
  const totalFail = st.fail + dy.fail;
  console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
  console.log(`动态：PASS=${dy.pass} FAIL=${dy.fail}`);
  console.log(`合计：PASS=${totalPass} FAIL=${totalFail}`);
  if (totalFail > 0 && !process.exitCode) process.exitCode = 1;
}

main();
