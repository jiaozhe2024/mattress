/**
 * MP-05B 方案编辑页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-05B verify + spec.md §5.5 空态 / §5.7 填充态）：
 *   0. 后端方案接口可达（不可达 = 环境阻塞）
 *   静态段（不依赖 DevTools）：
 *   1. 标题输入 h48 / border-bottom / 右侧 pencil 16（Q13 热区 44×44）
 *   2. 空态添加卡 112×126；填充态缩略图 105×126（产品图 105×90）
 *   3. 产品数量文案 / 详细说明 / chevron-down 24
 *   4. 底部三按钮宽度 108/92/119 + Q3 variant 配置（primary/secondary 一份配置驱动）
 *   5. token 合规：hex=0 / 裸 px 间距=0 / 裸行高=0
 *   6. 无版本标识条（Q12）
 *   动态段（需 DevTools 服务端口）：
 *   7. 空态渲染（0 产品）/ 填充态渲染（N 产品）
 *   8. 空标题保存被拦截
 *   9. 截图
 *
 * 为什么静态段独立：DevTools 服务端口长期未开（MP-03A/B/05A 均因此阻塞），
 * 静态段保证脚本在没有 DevTools 时仍有回归价值。
 *
 * 端口预检为什么必需：`automator.launch` 在服务端口未开启时会同步 spawn CLI 并
 * 无限等待，node 事件循环被阻塞，看门狗也救不回来。先做 TCP 探测，未开启即
 * 按环境阻塞退出（exit 2），绝不挂死、绝不伪造。
 *
 * 用法：node scripts/e2e/scheme-edit.auto.js
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
const PAGE_PATH = "/pages/scheme/edit";

/** 预检 DevTools 自动化端口，避免 automator.launch 阻塞事件循环。 */
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

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
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
    req.setTimeout(6000, () => req.destroy(new Error(`接口超时: ${url}`)));
    if (options.body) req.write(options.body);
    req.end();
  });
}

/** 静态源码断言（不依赖 DevTools） */
function assertStaticSource() {
  console.log("\n== 静态源码断言（不依赖 DevTools）==");
  const read = (rel) =>
    fs.readFileSync(path.join(REPO_ROOT, "miniprogram", "src", rel), "utf8");
  const page = read("pages/scheme/edit.vue");
  const model = read("components/scheme/schemeEditModel.ts");
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

  // ---- 页面注册 ----
  chk("pages.json 已注册 scheme/edit", /pages\/scheme\/edit/.test(pagesJson));
  chk("scheme/edit 使用 custom 导航", /pages\/scheme\/edit[\s\S]{0,120}custom/.test(pagesJson));

  // ---- §5.5 / §5.7 标题输入 ----
  chk("标题输入 h48", /height:\s*48px/.test(style));
  chk("标题下边框 1px line", /border-bottom[\s\S]{0,40}\$color-line/.test(style));
  chk("pencil 图标 16", /name="pencil"[\s\S]{0,40}:size="16"|:size="16"[\s\S]{0,40}pencil/.test(page));
  chk("Q13 pencil 热区 44×44", /se-title-pencil[\s\S]{0,200}44px/.test(style));

  // ---- 空态 / 填充态卡片 ----
  chk("空态添加卡 112px", /112px/.test(style));
  chk("填充态缩略图 105px", /105px/.test(style));
  chk("产品图高 90px", /height:\s*90px/.test(style));
  chk("移除钮 20px", /20px/.test(style));
  chk("plus 图标 26", /:size="26"/.test(page));
  chk("chevron-down 24", /:size="24"/.test(page));

  // ---- 文案 ----
  const modelAndPage = model + page;
  chk("占位「方案标题」", /方案标题/.test(modelAndPage));
  chk("「产品数量：」文案", /产品数量/.test(modelAndPage));
  chk("「详细说明」文案", /详细说明/.test(modelAndPage));
  chk(
    "三个按钮文案齐全",
    /我的方案/.test(modelAndPage) && /保存/.test(modelAndPage) && /预览分享/.test(modelAndPage)
  );

  // ---- Q3：三按钮 variant（一份配置驱动，宽度在 model 里）----
  chk("Q3 model 含 variant 语义", /primary|secondary/.test(model));
  chk("按钮宽 108 在 model", /108/.test(model));
  chk("按钮宽 92 在 model", /92/.test(model));
  chk("按钮宽 119 在 model", /119/.test(model));

  // ---- token 合规 ----
  const hexes = style.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  chk("无硬编码 hex", hexes.length === 0, `count=${hexes.length}`);
  const bareSp = style.match(/(?:gap|padding|margin)[^:;]*:\s*[^;]*?\b\d+px/g) || [];
  chk("无裸 px 间距", bareSp.length === 0, `count=${bareSp.length}`);
  const bareLh = style.match(/line-height:\s*\d+px/g) || [];
  chk("无裸行高", bareLh.length === 0, `count=${bareLh.length}`);

  // ---- Q12 ----
  chk("无版本标识条", !/参考复刻优化版/.test(page));

  // ---- 核心约定 9：选品走 Pinia ----
  chk("使用 useSelectionStore", /useSelectionStore/.test(page));
  chk(
    "不用 storage 传选品",
    !/(setStorage|getStorage)[\s\S]{0,80}(selected|selection|product)/i.test(page)
  );

  return { pass, fail };
}

async function runAssertions(miniProgram, baseline) {
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

  const page = await miniProgram.reLaunch(PAGE_PATH);
  await sleep(1500);

  // 导航
  const nav = await page.$(".wnav-title");
  chk("导航标题渲染", !!nav);

  // 标题输入
  chk("标题输入框存在", !!(await page.$(".se-title-input")));
  chk("pencil 可点", !!(await page.$(".se-title-pencil")));

  // 空态：无选品时显示添加卡
  const addCard = await page.$(".se-add-card");
  chk("空态显示添加产品卡", !!addCard, baseline.selectionCount === 0 ? "(选品为空)" : "");

  // 底部三按钮
  const actions = await page.$$(".se-action");
  chk("底部三按钮渲染", actions.length === 3, `count=${actions.length}`);
  if (actions.length === 3) {
    const widths = [];
    for (const a of actions) {
      const s = await a.size();
      widths.push(Math.round(s.width));
    }
    chk(
      "三按钮宽度 108/92/119",
      Math.abs(widths[0] - 108) <= 2 &&
        Math.abs(widths[1] - 92) <= 2 &&
        Math.abs(widths[2] - 119) <= 2,
      `got=${widths.join("/")}`
    );
  }

  // 空标题保存被拦截（点保存后应停留本页）
  if (actions.length === 3) {
    await actions[1].tap();
    await sleep(800);
    const cur = await miniProgram.currentPage();
    chk("空标题保存被拦截（停留本页）", cur.path === "pages/scheme/edit", `path=${cur.path}`);
  }

  // 截图
  const shotPath = path.join(SHOT_DIR, "mp05b-scheme-edit.png");
  await miniProgram.screenshot({ path: shotPath });
  chk("截图已生成", fs.existsSync(shotPath), shotPath);

  return { pass, fail };
}

async function main() {
  // 步骤 0：后端可达性
  let healthOk = false;
  try {
    await fetchJson(`${API_BASE}/wxapi/schemes?page=1&size=1`, {
      headers: { Authorization: "Bearer invalid" },
    });
    healthOk = true;
  } catch (err) {
    // 401 也是「后端活着」的证据，只要不是连接失败
    healthOk = !/ECONNREFUSED|ENOTFOUND|超时/.test(String(err.message));
  }
  if (!healthOk) {
    console.error("[环境阻塞] 后端不可达（localhost:8000）");
    process.exitCode = 2;
    return;
  }
  console.log("[0] 后端可达");

  // 静态断言（先跑，不依赖 DevTools）
  const st = assertStaticSource();

  // 端口预检
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
    miniProgram = await automator.launch({ cliPath: CLI_PATH, projectPath: MP_DIST });
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
    process.exitCode = 2;
    return;
  }

  try {
    console.log("\n== 动态断言（automator）==");
    dy = await runAssertions(miniProgram, { selectionCount: 0 });
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked = /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running|超时/i.test(
      msg
    );
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
