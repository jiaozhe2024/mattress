/**
 * MP-06「我的」页自动化验收脚本（miniprogram-automator）
 *
 * 断言内容（对照 tasks.json MP-06 verify + spec.md §5.10）：
 *   0. 后端 GET /wxapi/brand 可达（数据基准，不可达=环境阻塞）
 *   静态段（不依赖 DevTools）：
 *   1. 导航：一级页（非 back），标题 LEKASI 乐卡思
 *   2. 品牌卡 bg navy / px20 pt26 pb20 / gap24
 *   3. 品牌行 Inter Bold 15 yellow 字距 2
 *   4. 主标语 Medium 31 textInv 居中
 *   5. 标题强调条 72×3 bg yellow
 *   6. 三行段落 Regular 12 textInv 行高 1.45（文案取 intro，空则稿内三行兜底）
 *   7. 空间图 h315 圆角 8 object-cover + 图注 Regular 10 navy50 居中
 *   8. 「了解乐卡思」220×42 圆角 20 bg yellow，文字 Medium 15 navy 行高 22
 *   9. 联系行 Regular 12 textInv 居中
 *  10. 客服卡 bg navyDeep / px20 py24 / gap20
 *  11. 客服标题 message-circle 30×30 + 「乐卡思客服」Regular 27 textInv
 *  12. 客服三列等分 gap8、纵向 gap5，各含名称(12)+说明(10 navy50)
 *  13. TabBar「我的」选中（pages.json + custom-tab-bar 一致）
 *  14. 页面**无选款 FAB**（spec §5.10 ②）
 *  15. Q2：无「我的方案」入口（已知缺口，见 sprint-output）
 *  16. Q12：无版本标识条
 *  17. token 合规：hex=0 / 裸 px 间距=0 / 裸行高=0
 *  动态段（需 DevTools 服务端口）：
 *  18. 品牌卡实际渲染尺寸、空间图高度、按钮尺寸、客服三列等宽、截图
 *
 * 端口预检为什么必需：automator.launch 在服务端口未开启时同步 spawn CLI 并无限
 * 等待，node 事件循环被阻塞。先 TCP 探测，未开启即按环境阻塞退出（exit 2）。
 *
 * 用法：node scripts/e2e/mine.auto.js
 * 退出码：0=通过；1=断言失败；2=环境阻塞
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const { createRequire } = require("module");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MP_ROOT = path.join(REPO_ROOT, "miniprogram");
const MP_DIST = path.join(MP_ROOT, "dist", "dev", "mp-weixin");
const SHOT_DIR = path.join(REPO_ROOT, "docs", "exec-plans", "screenshots");
const CLI_PATH = "/Applications/wechatwebdevtools.app/Contents/MacOS/cli";
const API_BASE = "http://localhost:8000/api/v1";
const { resolveAutomationPort } = require("./_automationPort");

const localRequire = createRequire(require.resolve(path.join(MP_ROOT, "package.json")));
const automator = localRequire("miniprogram-automator");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 给可能无限阻塞的 automator 调用套硬超时。
 *
 * 为什么必需：miniprogram-automator 的 launch / reLaunch 在 DevTools 未登录或
 * 服务端口未开时会**无限等待**（内部同步 spawn CLI 后不返回），既没有 reject 也
 * 没有超时参数。MP-06 之前就有一个 e2e 进程因此挂死 23 小时，外层包装脚本的
 * `while (time.time()-start < 170)` 也救不了——条件只在 readline 返回后才检查。
 * 这里用 Promise.race 兜底，超时后按环境阻塞退出，绝不静默挂住。
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

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (err) {
          reject(new Error(`响应非 JSON（HTTP ${res.statusCode}）：${raw.slice(0, 200)}`));
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(6000, () => {
      req.destroy(new Error("请求超时"));
    });
  });
}

/**
 * 解析 DevTools 自动化端口（自动探测）。
 * 端口号由开发者工具首次启动随机分配并写入本地配置，
 * 硬编码会在别的机器上误判成「服务端口没开」。
 */
async function checkAutomationPort() {
  const resolved = await resolveAutomationPort();
  return { ok: resolved.port !== null, ...resolved };
}

/** 读源码做静态断言（不依赖 DevTools）。 */
function assertStaticSource() {
  const read = (rel) => fs.readFileSync(path.join(MP_ROOT, "src", rel), "utf8");
  const page = read("pages/user/index.vue");
  const model = read("components/user/mineModel.ts");
  const tokens = read("styles/tokens.scss");
  const pagesJson = read("pages.json");
  const styleOf = (src) => {
    const m = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return m ? m[1] : "";
  };
  const style = styleOf(page);
  // 只断言模板区：源码注释里讨论「不加我的方案」「不实现版本条」不算实现缺陷
  const templateOf = (src) => {
    const m = src.match(/<template>([\s\S]*?)<\/template>/);
    return m ? m[1] : "";
  };
  const template = templateOf(page);

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
  chk("pages.json 已注册 user/index", /pages\/user\/index/.test(pagesJson));
  chk(
    "user/index 使用 custom 导航",
    /pages\/user\/index[\s\S]{0,120}custom/.test(pagesJson)
  );

  // ---- §5.10 导航：一级页 ----
  chk("导航为一级页（WechatNav 无 back）", /<WechatNav\b(?![^>]*\bback\b)/.test(page));
  chk("导航标题取 MINE_NAV_TITLE", /MINE_NAV_TITLE/.test(page));
  chk("标题文案 LEKASI 乐卡思", /LEKASI 乐卡思/.test(model));

  // ---- 品牌卡 ----
  chk(
    "品牌卡 bg navy",
    /\.mine-brand-card[\s\S]{0,320}\$color-navy\b/.test(style)
  );
  chk(
    "品牌卡 padding 26/20/20",
    /\.mine-brand-card[\s\S]{0,260}padding:\s*\$space-26 \$space-20 \$space-20/.test(style)
  );
  chk("品牌卡 gap24", /\.mine-brand-card[\s\S]{0,200}gap:\s*\$space-24/.test(style));

  // ---- 品牌行 ----
  chk(
    "品牌行 Inter Bold 15",
    /\.mine-brand\b[\s\S]{0,220}\$font-family-en[\s\S]{0,80}\$font-15[\s\S]{0,80}\$font-weight-bold/.test(
      style
    )
  );
  chk("品牌行 yellow", /\.mine-brand\b[\s\S]{0,260}\$color-yellow\b/.test(style));
  chk("品牌行字距 2", /\.mine-brand\b[\s\S]{0,240}letter-spacing:\s*2px/.test(style));

  // ---- 主标语 ----
  chk(
    "主标语 Medium 31",
    /\.mine-slogan[\s\S]{0,220}\$font-31[\s\S]{0,80}\$font-weight-medium/.test(style)
  );
  chk("主标语 textInv", /\.mine-slogan[\s\S]{0,260}\$color-text-inv/.test(style));
  chk("主标语居中", /\.mine-slogan[\s\S]{0,280}text-align:\s*center/.test(style));
  chk("文案「遇见舒适好眠」", /遇见舒适好眠/.test(model));

  // ---- 强调条 72×3 ----
  chk(
    "强调条 72×3 bg yellow",
    /\.mine-underline[\s\S]{0,240}width:\s*72px[\s\S]{0,80}height:\s*3px[\s\S]{0,120}\$color-yellow/.test(
      style
    )
  );

  // ---- 三行段落 ----
  chk(
    "段落 Regular 12 行高 1.45",
    /\.mine-intro-line[\s\S]{0,240}\$font-12[\s\S]{0,200}\$line-height-12/.test(style)
  );
  chk("段落居中", /\.mine-intro-line[\s\S]{0,280}text-align:\s*center/.test(style));
  chk("理念区 py20 gap14", /\.mine-intro\b[\s\S]{0,240}gap:\s*\$space-14/.test(style));
  chk("稿内三行文案存在", /从一张床垫开始，认真对待每一次休息。/.test(model));
  chk("intro 兜底函数 introLinesOf", /introLinesOf/.test(model));
  chk("页面消费 introLinesOf", /introLinesOf\(/.test(page));

  // ---- 空间图 ----
  chk("空间图 h315", /\.mine-space\b[\s\S]{0,200}height:\s*315px/.test(style));
  chk("空间图圆角 radius-8", /\.mine-space\b[\s\S]{0,260}\$radius-8/.test(style));
  chk("空间图 object-cover（aspectFill）", /mode="aspectFill"/.test(page));
  chk(
    "图注 Regular 10 navy50 居中",
    /\.mine-space-caption[\s\S]{0,240}\$font-10[\s\S]{0,160}\$color-navy-50[\s\S]{0,120}text-align:\s*center/.test(
      style
    )
  );
  chk("图注文案", /家居展示空间示意/.test(model));

  // ---- 了解乐卡思按钮 ----
  chk(
    "按钮 220×42 圆角 20",
    /\.mine-learn\b[\s\S]{0,320}width:\s*220px[\s\S]{0,120}height:\s*42px[\s\S]{0,160}\$radius-20/.test(
      style
    )
  );
  chk("按钮 bg yellow", /\.mine-learn\b[\s\S]{0,380}\$color-yellow/.test(style));
  chk(
    "按钮文字 Medium 15 navy 行高 22",
    /\.mine-learn-text[\s\S]{0,240}\$font-15[\s\S]{0,80}\$font-weight-medium[\s\S]{0,160}\$line-height-15-fixed/.test(
      style
    )
  );
  chk("联系入口 gap10 居中", /\.mine-contact\b[\s\S]{0,240}gap:\s*\$space-10/.test(style));
  chk("联系行文案", /产品咨询 · 体验交流 · 合作联系/.test(model));

  // ---- Q7 品牌介绍页未设计 ----
  chk("了解乐卡思点击 toast（Q7）", /MINE_LEARN_PENDING_TOAST/.test(page));

  // ---- 客服卡 ----
  chk(
    "客服卡 bg navyDeep",
    /\.mine-service-card[\s\S]{0,320}\$color-navy-deep/.test(style)
  );
  chk(
    "客服卡 padding 24/20",
    /\.mine-service-card[\s\S]{0,280}padding:\s*\$space-24 \$space-20/.test(style)
  );
  chk("客服卡 gap20", /\.mine-service-card[\s\S]{0,200}gap:\s*\$space-20/.test(style));
  chk(
    "客服标题 gap10 居中",
    /\.mine-service-head\s*\{[\s\S]*?gap:\s*\$space-10[\s\S]*?\}/.test(style) &&
      /\.mine-service-head\s*\{[\s\S]*?justify-content:\s*center[\s\S]*?\}/.test(style)
  );
  chk("message-circle 图标 30", /name="message-circle"[\s\S]{0,60}:size="30"/.test(page));
  chk(
    "客服标题 Regular 27 textInv",
    /\.mine-service-title[\s\S]{0,240}\$font-27[\s\S]{0,160}\$color-text-inv/.test(style)
  );
  chk("客服标题文案", /乐卡思客服/.test(model));

  // ---- 客服三列 ----
  chk("客服列表 gap8", /\.mine-service-list[\s\S]{0,200}gap:\s*\$space-8/.test(style));
  chk(
    "客服项三列等分（flex:1）",
    /\.mine-service-item[\s\S]{0,200}flex:\s*1/.test(style)
  );
  chk("客服项纵向 gap5", /\.mine-service-item[\s\S]{0,260}gap:\s*\$space-5/.test(style));
  chk(
    "客服名称 Regular 12 textInv",
    /\.mine-service-name[\s\S]{0,240}\$font-12[\s\S]{0,160}\$color-text-inv/.test(style)
  );
  chk(
    "客服说明 Regular 10 navy50",
    /\.mine-service-caption[\s\S]{0,240}\$font-10[\s\S]{0,160}\$color-navy-50/.test(style)
  );
  chk("三项服务文案", /产品咨询/.test(model) && /睡感选择/.test(model) && /使用建议/.test(model));
  chk("每项说明「了解更多」", /MINE_SERVICE_LEARN/.test(model));

  // ---- TabBar ----
  chk(
    "TabBar 含「我的」且指向 user/index",
    /"pagePath":\s*"pages\/user\/index"[\s\S]{0,200}"text":\s*"我的"/.test(pagesJson)
  );
  chk(
    "自定义 TabBar 列表含 user 项",
    /key:\s*"user"[\s\S]{0,200}我的/.test(
      fs.readFileSync(path.join(MP_ROOT, "src", "custom-tab-bar", "index.js"), "utf8")
    )
  );

  // ---- 无 FAB / Q2 / Q12 ----
  chk("页面无选款 FAB", !/SelectFab/.test(page));
  chk("Q2：无「我的方案」入口（已知缺口）", !/我的方案/.test(template));
  chk("Q12：无版本标识条", !/参考复刻优化版/.test(template));
  chk("页面无版本号文案", !/version-bar|版本标识/.test(template));

  // ---- 客服可用性兜底 ----
  chk("客服配置校验 hasCustomerServiceConfig", /hasCustomerServiceConfig/.test(page));
  chk("placeholder 视为未配置", /placeholder/i.test(model));
  chk("客服失败兜底 toast", /MINE_SERVICE_FAIL_TOAST/.test(page));

  // ---- 数据来源 ----
  chk("调用 getBrand", /getBrand\(/.test(page));
  chk("调用空间图兜底 spaceImageOf", /spaceImageOf\(/.test(page));
  chk("新增 token space-26", /\$space-26:\s*26px/.test(tokens));

  // ---- token 合规 ----
  const hexes = style.match(/#[0-9a-fA-F]{3,6}\b/g) || [];
  chk("无硬编码 hex", hexes.length === 0, `count=${hexes.length}`);
  const bareSp = style.match(/(?:gap|padding|margin)[^:;]*:\s*[^;]*?\b\d+px/g) || [];
  chk("无裸 px 间距", bareSp.length === 0, `count=${bareSp.length}`);
  const bareLh = style.match(/line-height:\s*\d+px/g) || [];
  chk("无裸行高", bareLh.length === 0, `count=${bareLh.length}`);

  return { pass, fail };
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

  const page = await withTimeout(
    miniProgram.reLaunch("/pages/user/index"),
    20000,
    "reLaunch /pages/user/index"
  );
  await sleep(1800);

  const el = async (selector) => page.$(selector);
  const sizeOf = async (selector) => {
    const node = await el(selector);
    if (!node) return null;
    return node.size();
  };

  // 品牌卡
  const brandCard = await el(".mine-brand-card");
  chk("品牌卡已渲染", brandCard !== null);

  const slogan = await page.$(".mine-slogan");
  const sloganText = slogan ? await slogan.text() : "";
  chk("主标语文案", sloganText.trim() === "遇见舒适好眠", `got="${sloganText}"`);

  const underline = await sizeOf(".mine-underline");
  chk(
    "强调条 72×3",
    underline !== null && Math.round(underline.width) === 72 && Math.round(underline.height) === 3,
    underline ? `${underline.width}x${underline.height}` : "null"
  );

  // 空间图：h315（有图或占位层都应存在）
  const space = await sizeOf(".mine-space");
  chk(
    "空间图高 315",
    space !== null && Math.round(space.height) === 315,
    space ? `h=${space.height}` : "null"
  );

  // 按钮 220×42
  const learn = await sizeOf(".mine-learn");
  chk(
    "了解乐卡思 220×42",
    learn !== null && Math.round(learn.width) === 220 && Math.round(learn.height) === 42,
    learn ? `${learn.width}x${learn.height}` : "null"
  );

  // 客服卡 + 三列等宽
  const serviceCard = await el(".mine-service-card");
  chk("客服卡已渲染", serviceCard !== null);

  const items = await page.$$(".mine-service-item");
  chk("客服项数=3", items.length === 3, `got=${items.length}`);
  if (items.length === 3) {
    const widths = [];
    for (const item of items) {
      const s = await item.size();
      widths.push(Math.round(s.width));
    }
    const maxDiff = Math.max(...widths) - Math.min(...widths);
    chk("三列等宽（宽度差 ≤2px）", maxDiff <= 2, `widths=${widths.join(",")}`);
  }

  // 三个服务名称
  const names = await page.$$(".mine-service-name");
  const nameTexts = [];
  for (const node of names) nameTexts.push((await node.text()).trim());
  chk(
    "服务名称三项正确",
    JSON.stringify(nameTexts) === JSON.stringify(["产品咨询", "睡感选择", "使用建议"]),
    nameTexts.join("/")
  );

  // 无 FAB
  const fab = await page.$(".select-fab");
  chk("页面无选款 FAB", fab === null);

  // 截图
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const shot = path.join(SHOT_DIR, "mine-actual.png");
  await miniProgram.screenshot({ path: shot });
  chk("截图已保存", fs.existsSync(shot), shot);

  return { pass, fail };
}

async function main() {
  // 后端可达性（品牌接口是数据基准）
  try {
    const brand = await httpJson(`${API_BASE}/wxapi/brand`);
    if (brand.status !== 200 || !brand.body || brand.body.code !== 200) {
      throw new Error(`品牌接口返回异常 HTTP ${brand.status}`);
    }
    const configured = brand.body.data !== null;
    console.log(
      `[0] 后端可达（/wxapi/brand 200，品牌配置${configured ? "已录入" : "为 null → 走稿内兜底"}）`
    );
  } catch (err) {
    console.error(`[环境阻塞] 后端不可达：${err.message}`);
    process.exitCode = 2;
    return;
  }

  console.log("\n== 静态断言（源码）==");
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
let miniProgram;
  let dy = { pass: 0, fail: 0 };
  try {
    miniProgram = await withTimeout(
      automator.launch({ cliPath: CLI_PATH, projectPath: MP_DIST }),
      60000,
      "automator.launch"
    );
  } catch (err) {
    console.error(`[环境阻塞] automator 启动失败：${err.message}`);
    console.log(`\n静态：PASS=${st.pass} FAIL=${st.fail}`);
    process.exitCode = 2;
    return;
  }

  try {
    console.log("\n== 动态断言（automator）==");
    dy = await runAssertions(miniProgram);
  } catch (err) {
    const msg = String((err && err.message) || err);
    const blocked =
      /login|登录|port|端口|automation|无法|refused|ECONNREFUSED|not running|超时|未返回|未就绪/i.test(
        msg
      );
    console.error(blocked ? `[环境阻塞] ${msg}` : `[断言失败] ${msg}`);
    process.exitCode = blocked ? 2 : 1;
  } finally {
    // close 也可能挂：再套一层超时，保证进程一定退出
    if (miniProgram) {
      await withTimeout(Promise.resolve(miniProgram.close()), 8000, "miniProgram.close").catch(
        () => {}
      );
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
