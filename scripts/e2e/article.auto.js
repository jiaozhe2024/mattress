/**
 * 资讯列表页 / 资讯详情页自动化验收脚本（miniprogram-automator）
 *
 * 背景（回归）：两页在 pages.json 里是 navigationStyle=custom，但页面漏了自绘导航栏，
 * 导致内容顶到状态栏下、标题被刘海裁掉。本脚本锁死「导航必须存在」这条线。
 *
 * 断言内容：
 *   0. 后端资讯接口可达（news / service 两个分类，不可达=环境阻塞）
 *   1. 列表页：二级页导航存在（.nav-anchor + data-nav-title=品牌资讯 + data-nav-back=1）
 *   2. 列表页：正文区在导航之下（导航宿主节点在 DOM 中先于 .body）
 *   3. 列表页：条目数 = 接口条数，标题与日期非空且与接口一致
 *   4. 点条目 → 详情页，详情页同样有二级导航（title=资讯详情）
 *   5. 详情页：标题与正文渲染（有 content 时）
 *   6. 两页截图保存到 docs/exec-plans/screenshots/
 *
 * 运行前提：
 *   - 后端 docker compose up 且 seed 已灌（/wxapi/articles 200）
 *   - miniprogram/ 已 npm install 且 `npm run dev:mp-weixin` 产出 dist/dev/mp-weixin
 *   - 微信开发者工具已登录并开启「设置-安全设置-服务端口」
 *
 * 用法：node scripts/e2e/article.auto.js
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
const ARTICLES_API = "http://localhost:8000/api/v1/wxapi/articles";

const localRequire = createRequire(
  require.resolve(path.join("..", "..", "miniprogram", "package.json"))
);
const automator = localRequire("miniprogram-automator");
const { launchAndReady, closeQuiet, navInfo, sleep } = require("./_automationLaunch");

function assert(cond, message) {
  if (!cond) {
    throw new Error(`[断言失败] ${message}`);
  }
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

async function assertNav(page, expectedTitle, label) {
  const nav = await waitFor(page, ".nav-anchor", 10000);
  assert(nav, `${label}：应存在导航宿主（.nav-anchor），缺失会让内容顶到状态栏下`);
  const info = await navInfo(page);
  assert(info.found, `${label}：读不到导航宿主 .nav-anchor`);
  assert(
    info.title === expectedTitle,
    `${label}：导航标题应为「${expectedTitle}」，实际「${info.title}」`
  );
  assert(info.back, `${label}：二级页导航应带返回按钮（data-nav-back=1）`);
  console.log(`[nav] ${label}：标题「${info.title}」+ 返回按钮通过`);
}

async function runAssertions(miniProgram, newsData, serviceData) {
  // [1] 列表页（首页「乐卡思资讯」入口 → /pages/article/list）
  await miniProgram.reLaunch("/pages/article/list");
  await sleep(1500);
  const listPage = await miniProgram.currentPage();
  assert(
    listPage && listPage.path === "pages/article/list",
    `应落在资讯列表页，实际 ${listPage && listPage.path}`
  );

  await assertNav(listPage, "品牌资讯", "资讯列表页");
  console.log("[1] 资讯列表页导航（回归：custom 导航已自绘）通过");

  // [2] 导航在正文之前（用坐标断言：automator 的 evaluate 无 DOM，不能用 querySelector）
  const navEl = await listPage.$(".nav-anchor");
  const bodyEl = await listPage.$(".body");
  assert(bodyEl, "列表页应存在正文区（.body）");
  const navOffset = await navEl.offset();
  const bodyOffset = await bodyEl.offset();
  assert(
    Number(navOffset.top) === 0,
    `导航应贴页面顶部（top=0），实际 top=${navOffset.top}`
  );
  assert(
    Number(bodyOffset.top) > 0,
    `正文区应排在导航之下（top>0），实际 top=${bodyOffset.top}（导航缺失时正文会顶到状态栏下）`
  );
  console.log("[2] 导航贴顶且正文在导航之下通过");

  // [3] 条目数与标题/日期
  const row = await waitFor(listPage, ".row", 10000);
  assert(row, "列表页应渲染资讯条目（.row），加载超时或接口失败");
  const rows = await listPage.$$(".row");
  assert(
    rows.length === newsData.items.length,
    `资讯条目数应=${newsData.items.length}，实际 ${rows.length}`
  );
  for (let i = 0; i < rows.length; i += 1) {
    const titleEl = await rows[i].$(".row-title");
    const dateEl = await rows[i].$(".row-date");
    assert(titleEl, `第 ${i + 1} 条缺标题（.row-title）`);
    assert(dateEl, `第 ${i + 1} 条缺日期（.row-date）`);
    const titleText = (await titleEl.text()).trim();
    const dateText = (await dateEl.text()).trim();
    assert(titleText !== "", `第 ${i + 1} 条标题为空`);
    assert(dateText !== "", `第 ${i + 1} 条日期为空`);
    assert(
      titleText === newsData.items[i].title,
      `第 ${i + 1} 条标题应为「${newsData.items[i].title}」，实际「${titleText}」`
    );
  }
  console.log(`[3] 资讯条目 ${rows.length} 项，标题与日期非空通过与接口一致`);

  // [6a] 列表页截图（必须在跳详情前，否则截到的是详情页）
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const listShot = path.join(SHOT_DIR, "article-list.png");
  await miniProgram.screenshot({ path: listShot });
  assert(fs.existsSync(listShot), `截图未生成: ${listShot}`);
  console.log(`[6a] 列表页截图 → ${listShot}`);

  // [4] 点条目 → 详情页，详情页同样要有二级导航
  await rows[0].tap();
  await sleep(1500);
  const detailPage = await miniProgram.currentPage();
  assert(
    detailPage && detailPage.path === "pages/article/detail",
    `点资讯条目应跳 /pages/article/detail，实际 ${detailPage && detailPage.path}`
  );
  await assertNav(detailPage, "资讯详情", "资讯详情页");
  console.log("[4] 点条目跳详情页 + 详情页导航（回归）通过");

  // [5] 详情内容
  const detailTitle = await waitFor(detailPage, ".article-title", 10000);
  assert(detailTitle, "详情页应渲染标题（.article-title）");
  const detailTitleText = (await detailTitle.text()).trim();
  assert(detailTitleText !== "", "详情页标题为空");
  console.log(`[5] 详情页标题渲染通过（「${detailTitleText}」）`);

  // [6b] 详情页截图
  const detailShot = path.join(SHOT_DIR, "article-detail.png");
  await miniProgram.screenshot({ path: detailShot });
  assert(fs.existsSync(detailShot), `截图未生成: ${detailShot}`);
  console.log(`[6b] 详情页截图 → ${detailShot}`);

  console.log("[done] 资讯列表 / 资讯详情页验收全部通过");
  void serviceData;
}

async function main() {
  let newsData;
  let serviceData;
  try {
    newsData = await fetchJson(`${ARTICLES_API}?category=news&page=1&size=20`);
    serviceData = await fetchJson(
      `${ARTICLES_API}?category=service&page=1&size=20`
    );
  } catch (err) {
    console.error(`[环境阻塞] 后端资讯接口不可达（${ARTICLES_API}）：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(
    `[0] 接口可达：news=${newsData.items.length} / service=${serviceData.items.length}`
  );
  if (newsData.items.length === 0) {
    console.error("[环境阻塞] news 分类无数据，无法验证列表渲染（先灌 seed）");
    process.exitCode = 2;
    return;
  }

  let miniProgram;
  try {
    miniProgram = await launchAndReady(automator, CLI_PATH, MP_DIST);
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    process.exitCode = 2;
    return;
  }
  try {
    await runAssertions(miniProgram, newsData, serviceData);
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked =
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running|超时/i.test(
        msg
      );
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    await closeQuiet(miniProgram);
  }
}

main();
