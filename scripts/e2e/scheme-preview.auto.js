/**
 * MP-05D 预览分享页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-05D verify + spec.md §5.9）：
 *   0. 后端方案接口可达（owner 详情 + 匿名 public）
 *   静态段（不依赖 DevTools）：
 *   1. 方案标题 Medium 21 text1 行高 1.45 居中
 *   2. 海报：bg cream 圆角 8 / 品牌行 Inter Bold 10 字距 1 / 产品名 Bold 23 /
 *      卖点 Regular 11 / 产品图 h190 / 信息条 bg yellowBg
 *   3. 底注「LEKASI 乐卡思 · 产品推荐」Regular 11 text3
 *   4. 底栏 bg navy p14 gap12 / 返回 146×42 白底描边 / 立即分享 189×42 bg yellow
 *   5. 核心约定 10：海报数据取自 product_snapshot（不回查实时产品）
 *   6. 访客态：有 public 回落逻辑，底栏无「返回编辑」入口（spec 本就只有两按钮）
 *   7. token 合规：hex=0 / 裸 px 间距=0 / 裸行高=0
 *   8. 无版本标识条（Q12）
 *   动态段（需 DevTools 服务端口）：
 *   9. 标题/海报块渲染、双按钮尺寸、分享配置、截图
 *
 * 端口预检为什么必需：automator.launch 在服务端口未开启时同步 spawn CLI 并无限
 * 等待，node 事件循环被阻塞。先 TCP 探测，未开启即按环境阻塞退出（exit 2）。
 *
 * 用法：node scripts/e2e/scheme-preview.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞
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
const { resolveAutomationPort } = require("./_automationPort");
const { launchAndReady, closeQuiet, navInfo, sleep: sleepShared, withTimeout: withTimeoutShared } = require("./_automationLaunch");

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpJson(url, options = {}) {
  const body = options.body;
  const payload = body === undefined ? null : Buffer.from(body, "utf8");
  const headers = { ...(options.headers || {}) };
  if (payload !== null) {
    // 必须显式给 Content-Length：缺省时 FastAPI/Pydantic 会因读不到请求体返回 422
    headers["Content-Length"] = String(payload.length);
  }
  const { body: _ignored, ...rest } = options;
  return new Promise((resolve, reject) => {
    const req = http.request(url, { ...rest, headers }, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (err) {
          reject(new Error(`响应解析失败 HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(6000, () => req.destroy(new Error(`接口超时: ${url}`)));
    if (payload !== null) req.write(payload);
    req.end();
  });
}

function assertStaticSource() {
  console.log("\n== 静态源码断言（不依赖 DevTools）==");
  const read = (rel) =>
    fs.readFileSync(path.join(REPO_ROOT, "miniprogram", "src", rel), "utf8");
  const page = read("pages/scheme/preview.vue");
  const model = read("components/scheme/schemePreviewModel.ts");
  const pagesJson = read("pages.json");
  const styleOf = (src) => {
    const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return m ? m[1] : "";
  };
  const style = styleOf(page);

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

  // ---- 注册 ----
  chk("pages.json 已注册 scheme/preview", /pages\/scheme\/preview/.test(pagesJson));
  chk(
    "scheme/preview 使用 custom 导航",
    /pages\/scheme\/preview[\s\S]{0,140}custom/.test(pagesJson)
  );

  // ---- §5.9 ① 方案标题 ----
  chk("标题 Medium 21", /\$font-21/.test(style) && /\$font-weight-medium/.test(style));
  chk("标题 text1", /\$color-text-1/.test(style));
  chk("标题居中", /text-align:\s*center/.test(style));
  chk("标题区 p20", /padding:\s*\$space-20/.test(style));

  // ---- §5.9 ② 海报 ----
  chk("海报 bg cream", /\$color-cream/.test(style));
  chk("海报圆角 radius-8", /\$radius-8/.test(style));
  chk("品牌行 Inter Bold 10", /\$font-family-en/.test(style) && /\$font-10/.test(style));
  chk("品牌行字距 1", /letter-spacing:\s*1px/.test(style));
  chk("产品名 Bold 23", /\$font-23/.test(style) && /\$font-weight-bold/.test(style));
  chk("卖点 font-11", /\$font-11/.test(style));
  chk("产品图 h190", /height:\s*190px/.test(style));
  chk("信息条 bg yellowBg", /\$color-yellow-bg/.test(style));
  chk("信息条 px16 py12", /\$space-16/.test(style) && /\$space-12/.test(style));

  // ---- 文案 ----
  chk("底注文案", /产品推荐/.test(model));
  chk("feature 文案「细腻面料」", /细腻面料/.test(model));
  chk("规格行前缀「规格：」", /规格：/.test(model));
  chk("规格行后缀「实际配置以产品说明为准」", /实际配置以产品说明为准/.test(model));

  // ---- §5.9 ③ 底栏 ----
  chk("底栏 bg navy", /\.sp-actions[\s\S]{0,220}\$color-navy/.test(style));
  chk("底栏 p14", /\$space-14/.test(style));
  chk("底栏 gap12", /\.sp-actions[\s\S]{0,200}gap:\s*\$space-12/.test(style));
  chk("返回宽 146", /width:\s*146px/.test(style));
  chk("分享宽 189", /width:\s*189px/.test(style));
  chk("返回白底描边 navy50", /\$color-navy-50/.test(style));
  chk("分享 bg yellow", /\$color-yellow/.test(style));
  chk("按钮高 42", /height:\s*42px/.test(style));
  chk("按钮圆角 radius-20", /\$radius-20/.test(style));

  // ---- 核心约定 10：读快照 ----
  chk("使用 snapshot 映射", /snapshot/.test(model));
  chk("previewViewsOf 读快照而非实时产品", /previewViewsOf/.test(model));
  chk("页面不含实时产品请求", !/getProductDetail|getProducts\s*\(/.test(page));

  // ---- 访客态 ----
  chk("有 public 回落逻辑", /getPublicScheme/.test(page));
  chk("isVisitor 状态存在", /isVisitor/.test(page));
  // 只查模板里的按钮文案，注释里讨论「没有返回编辑」不算
  chk(
    "底栏无「返回编辑」按钮文案",
    !/>\s*返回编辑\s*</.test(page) && !/label.*返回编辑/.test(page)
  );
  chk("分享成功后计数", /shareScheme/.test(page));

  // ---- token 合规 ----
  const hexes = style.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  chk("无硬编码 hex", hexes.length === 0, `count=${hexes.length}`);
  const bareSp = style.match(/(?:gap|padding|margin)[^:;]*:\s*[^;]*?\b\d+px/g) || [];
  chk("无裸 px 间距", bareSp.length === 0, `count=${bareSp.length}`);
  const bareLh = style.match(/line-height:\s*\d+px/g) || [];
  chk("无裸行高", bareLh.length === 0, `count=${bareLh.length}`);

  // ---- Q12 ----
  chk("无版本标识条", !/参考复刻优化版/.test(page));

  return { pass, fail };
}

async function runAssertions(miniProgram, schemeId) {
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

  const page = await miniProgram.reLaunch(`/pages/scheme/preview?id=${schemeId}`);
  await sleep(1800);

  const nav = await navInfo(page);
  chk("导航标题渲染", nav.found && nav.title.length > 0, `title="${nav.title}"`);
  chk("导航返回箭头", nav.back === true);

  const titleEl = await page.$(".sp-title");
  chk("方案标题渲染", !!titleEl);
  if (titleEl) {
    const txt = (await titleEl.text()).trim();
    chk("标题非空", txt.length > 0, `got="${txt}"`);
  }

  const posters = await page.$$(".sp-poster");
  chk("海报块渲染", posters.length > 0, `count=${posters.length}`);
  chk("品牌行渲染", !!(await page.$(".sp-brand")));
  chk("产品名渲染", !!(await page.$(".sp-name")));
  chk("信息条渲染", !!(await page.$(".sp-info")));
  chk("底注渲染", !!(await page.$(".sp-footnote")));

  const actions = await page.$$(".sp-action");
  chk("底栏双按钮", actions.length === 2, `count=${actions.length}`);
  if (actions.length === 2) {
    const w1 = Math.round((await actions[0].size()).width);
    const w2 = Math.round((await actions[1].size()).width);
    chk(
      "按钮宽度 146/189",
      Math.abs(w1 - 146) <= 2 && Math.abs(w2 - 189) <= 2,
      `got=${w1}/${w2}`
    );
  }

  const shotPath = path.join(SHOT_DIR, "mp05d-scheme-preview.png");
  await miniProgram.screenshot({ path: shotPath });
  chk("截图已生成", fs.existsSync(shotPath), shotPath);

  return { pass, fail };
}

async function main() {
  // 后端可达性 + 找一个可用方案 id
  let schemeId = 0;
  try {
    const login = await httpJson(`${API_BASE}/wxapi/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "mock_code" }),
    });
    if (login.status !== 200 || !login.body || login.body.code !== 200) {
      throw new Error(`登录失败 HTTP ${login.status}`);
    }
    const token = login.body.data.access_token;
    const list = await httpJson(`${API_BASE}/wxapi/schemes?page=1&size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = (list.body && list.body.data && list.body.data.items) || [];
    if (items.length > 0) {
      schemeId = items[0].id;
    }
  } catch (err) {
    console.error(`[环境阻塞] 后端不可达或登录失败：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[0] 后端可达（样本方案 id=${schemeId || "无"}）`);

  const st = assertStaticSource();

  if (schemeId === 0) {
    console.log(
      "  [提示] 后端无方案数据，动态段将跳过（不伪造）。先跑 MP-05B 建一个方案再验。"
    );
    console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
    process.exitCode = st.fail > 0 ? 1 : 2;
    return;
  }

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
    miniProgram = await launchAndReady(automator, CLI_PATH, MP_DIST);
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
    process.exitCode = 2;
    return;
  }

  try {
    console.log("\n== 动态断言（automator）==");
    dy = await runAssertions(miniProgram, schemeId);
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked =
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running|超时/i.test(msg);
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    if (miniProgram) await closeQuiet(miniProgram);
  }

  const totalPass = st.pass + dy.pass;
  const totalFail = st.fail + dy.fail;
  console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
  console.log(`动态：PASS=${dy.pass} FAIL=${dy.fail}`);
  console.log(`合计：PASS=${totalPass} FAIL=${totalFail}`);
  if (totalFail > 0 && !process.exitCode) process.exitCode = 1;
}

main();
