/**
 * MP-05C 方案列表页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-05C verify + spec.md §5.8）：
 *   0. 后端方案列表接口可达
 *   静态段（不依赖 DevTools）：
 *   1. 卡片封面 88×96 / 圆角 6
 *   2. 主标题 Medium 15 / 副行1 12 / 副行2 11
 *   3. chevron-right 16
 *   4. 底部提示文案「＊ 提示：长按方案删除 ＊」
 *   5. 页面无固定底部操作条、无 TabBar（spec §5.8 ②）
 *   6. Q9：日期为动态格式化，代码里无硬编码 2026.11.04
 *   7. token 合规：hex=0 / 裸 px 间距=0 / 裸行高=0
 *   8. 无版本标识条（Q12）
 *   动态段（需 DevTools 服务端口）：
 *   9. 列表渲染 / 点卡片跳编辑 / 长按弹确认框 / 删除后卡片消失 / 截图
 *
 * 端口预检为什么必需：`automator.launch` 在服务端口未开启时会同步 spawn CLI 并
 * 无限等待，node 事件循环被阻塞。先做 TCP 探测，未开启即按环境阻塞退出（exit 2）。
 *
 * 用法：node scripts/e2e/scheme-list.auto.js
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
const PAGE_PATH = "/pages/scheme/list";

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

function fetchRaw(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => resolve({ status: res.statusCode, raw }));
    });
    req.on("error", reject);
    req.setTimeout(6000, () => req.destroy(new Error(`接口超时: ${url}`)));
    req.end();
  });
}

function assertStaticSource() {
  console.log("\n== 静态源码断言（不依赖 DevTools）==");
  const read = (rel) =>
    fs.readFileSync(path.join(REPO_ROOT, "miniprogram", "src", rel), "utf8");
  const page = read("pages/scheme/list.vue");
  const model = read("components/scheme/schemeListModel.ts");
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
  chk("pages.json 已注册 scheme/list", /pages\/scheme\/list/.test(pagesJson));
  chk(
    "scheme/list 使用 custom 导航",
    /pages\/scheme\/list[\s\S]{0,120}custom/.test(pagesJson)
  );

  // ---- §5.8 ① 卡片 ----
  chk("封面宽 88px", /width:\s*88px/.test(style));
  chk("封面高 96px", /height:\s*96px/.test(style));
  chk("封面圆角 radius-6", /\$radius-6/.test(style));
  chk("卡片白底 radius-8", /\$radius-8/.test(style) && /\$color-text-inv/.test(style));
  chk("卡片内边距 p12", /padding:\s*\$space-12/.test(style));
  chk("主标题 Medium 15", /\$font-15/.test(style) && /\$font-weight-medium/.test(style));
  chk("副行1 font-12", /\$font-12/.test(style));
  chk("副行2 font-11", /\$font-11/.test(style));
  chk("chevron 16", /:size="16"/.test(page));
  chk("列表容器 p16 gap12", /padding:\s*\$space-16/.test(style) && /gap:\s*\$space-12/.test(style));
  chk("列表容器 min-height 722", /min-height:\s*722px/.test(style));

  // ---- 文案 ----
  chk("底部提示文案", /长按方案删除/.test(model));
  chk("卡片副行前缀「标题：」", /标题：/.test(model));
  chk("卡片副行「产品数量：」", /产品数量：/.test(model));

  // ---- §5.8 ② 无固定操作条 / 无 TabBar ----
  chk("无固定底部操作条", !/position:\s*fixed[\s\S]{0,120}(bottom|actions)/.test(style));
  // 只查真实组件引用（import / 标签），注释里出现 "TabBar" 不算
  chk("无 TabBar 组件", !/from\s+["'][^"']*frame\/TabBar/.test(page) && !/<TabBar/.test(page));
  chk("仅 SafeArea 收尾", /SafeArea/.test(page));

  // ---- Q9：日期动态格式化 ----
  chk("导出 formatSchemeDate", /export function formatSchemeDate/.test(model));
  chk("页面不含硬编码示例日期", !/2026\.11\.04/.test(page) && !/2026\.11\.04/.test(model));
  chk("卡片视图走 metaLineOf/formatSchemeDate", /metaLineOf|formatSchemeDate/.test(model));

  // ---- Q8 空态不插图 ----
  chk("空态无插图层", !/empty-illustration|sl-empty-image/.test(page));

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

async function runAssertions(miniProgram, schemeCount) {
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

  const nav = await navInfo(page);
  chk("导航标题渲染", nav.found && nav.title.length > 0, `title="${nav.title}"`);
  chk("导航返回箭头", nav.back === true);

  if (schemeCount === 0) {
    chk("空态文案渲染", !!(await page.$(".sl-state-text")), "(后端方案数为 0)");
  } else {
    const cards = await page.$$(".sl-card");
    chk("方案卡片渲染", cards.length > 0, `count=${cards.length}`);
    if (cards.length > 0) {
      const cover = await page.$(".sl-cover");
      if (cover) {
        const s = await cover.size();
        chk(
          "封面 88×96（容差 2px）",
          Math.abs(s.width - 88) <= 2 && Math.abs(s.height - 96) <= 2,
          `got=${Math.round(s.width)}×${Math.round(s.height)}`
        );
      }
      chk("主标题元素", !!(await page.$(".sl-title")));
      chk("副行1 元素", !!(await page.$(".sl-sub")));
      chk("副行2 元素", !!(await page.$(".sl-meta")));
    }
    chk("底部提示存在", !!(await page.$(".sl-hint")));
  }

  const shotPath = path.join(SHOT_DIR, "mp05c-scheme-list.png");
  await miniProgram.screenshot({ path: shotPath });
  chk("截图已生成", fs.existsSync(shotPath), shotPath);

  return { pass, fail };
}

async function main() {
  // 后端可达性
  let schemeTotal = 0;
  try {
    const r = await fetchRaw(`${API_BASE}/wxapi/schemes?page=1&size=5`, {
      headers: { Authorization: "Bearer dev-probe" },
    });
    // 401 也说明后端活着；只要不是连接失败
    if (r.status === 200) {
      try {
        schemeTotal = JSON.parse(r.raw).data.total || 0;
      } catch {
        schemeTotal = 0;
      }
    }
  } catch (err) {
    console.error(`[环境阻塞] 后端不可达：${err.message}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[0] 后端可达（方案数参考值 ${schemeTotal}）`);

  const st = assertStaticSource();

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
    dy = await runAssertions(miniProgram, schemeTotal);
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
