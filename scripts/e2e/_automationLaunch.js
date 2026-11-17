/**
 * E2E 公共工具：稳定的 automator 启动 / 就绪等待 / 收尾。
 *
 * 为什么需要这个模块（IDE 2.02 + automator 0.12 实测的三个坑）：
 *
 * 1. `currentPage()` 存在就绪竞态
 *    launch() resolve 只代表 DevTools 进程起来了，不代表模拟器页面元信息已注册。
 *    此时调 currentPage() 会在库内部抛
 *      "Cannot destructure property 'rawPath' of 't.getPageMetaByWebviewId(...)' as it is null"
 *    旧脚本 launch 后固定 sleep(1500)，在 2.x 上时间不够。
 *    → 改为 waitForReady()：轮询 currentPage()，把上述 null 元信息错误当作「还没好」继续等。
 *
 * 2. 连续跑多个脚本时 launch 会失败
 *      "Failed to launch wechat web DevTools, please make sure http port is open"
 *    因为上一个脚本 close() 后 IDE 进程退出需要时间，紧接着 launch 会撞上正在退出的实例。
 *    → launchStable() 内置重试：失败后等待 DevTools 进程消失再试。
 *
 * 3. launch / currentPage / close 都可能无限挂住（既不 resolve 也不 reject）
 *    miniprogram-automator 不提供超时参数。
 *    → withTimeout() 给每个调用套硬超时。
 *
 * 用法：
 *   const { launchAndReady, withTimeout, sleep, closeQuiet } = require("./_automationLaunch");
 *   const mp = await launchAndReady(automator, CLI_PATH, MP_DIST);
 *   try { ... } finally { await closeQuiet(mp); }
 */
const { execSync } = require("child_process");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 给 automator 调用套硬超时。库本身无超时参数，DevTools 未就绪时会无限挂住。
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

/** DevTools 进程是否还在跑（用于判断退出是否彻底）。 */
function devtoolsRunning() {
  try {
    const out = execSync("pgrep -f 'wechatwebdevtools.app/Contents' || true", {
      encoding: "utf8",
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/** 强制结束 DevTools。重试前用，确保下一次 launch 拿到干净的实例。 */
function killDevtools() {
  try {
    execSync("pkill -9 -f 'wechatwebdevtools.app/Contents' || true");
  } catch {
    /* 没进程也无所谓 */
  }
}

/**
 * 等 DevTools 进程完全退出（最多 timeoutMs）。
 *
 * 注意：IDE 2.x 是 Electron 应用，close() 只关模拟器窗口、**不会退出 App 进程**，
 * 所以等待进程自然退出通常是徒劳的。仅作为优雅等待，超时后由调用方 killDevtools()。
 */
async function waitDevtoolsExited(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!devtoolsRunning()) return true;
    await sleep(500);
  }
  return !devtoolsRunning();
}

/**
 * 页面元信息尚未注册时的库内部错误特征。
 * 出现这类错误说明「还没就绪」，应当继续轮询而不是判定失败。
 */
function isNotReadyError(err) {
  const msg = String((err && err.message) || err);
  return (
    /rawPath/.test(msg) ||
    /getPageMetaByWebviewId/.test(msg) ||
    /as it is null/.test(msg) ||
    /超过 \d+ms 未返回/.test(msg)
  );
}

/**
 * 轮询 currentPage() 直到返回有效页面。
 * @returns {Promise<{page: object, elapsedMs: number}>}
 */
async function waitForReady(mp, { timeoutMs = 60000, pollMs = 500 } = {}) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const page = await withTimeout(mp.currentPage(), 10000, "currentPage");
      if (page && page.path) {
        return { page, elapsedMs: Date.now() - start };
      }
    } catch (err) {
      lastErr = err;
      if (!isNotReadyError(err)) throw err;
    }
    await sleep(pollMs);
  }
  throw new Error(
    `DevTools 模拟器 ${timeoutMs}ms 内未就绪（最后一次错误：${
      lastErr ? lastErr.message : "currentPage 返回空页面"
    }）`
  );
}

/**
 * 启动 automator 并等到模拟器就绪。
 *
 * @param {object} automator  miniprogram-automator 模块
 * @param {string} cliPath    开发者工具 CLI 路径
 * @param {string} projectPath 编译产物目录（dist/dev/mp-weixin）
 * @param {object} [opts]
 * @param {number} [opts.attempts=3]      launch 重试次数（应对上一实例未退干净）
 * @param {number} [opts.launchTimeout=90000]
 * @param {number} [opts.readyTimeout=60000]
 * @param {(msg: string)=>void} [opts.log]
 * @returns {Promise<object>} miniProgram 实例
 */
async function launchAndReady(automator, cliPath, projectPath, opts = {}) {
  const {
    attempts = 3,
    launchTimeout = 90000,
    readyTimeout = 60000,
    log = (m) => console.log(m),
  } = opts;

  let lastErr = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      const mp = await withTimeout(
        automator.launch({ cliPath, projectPath }),
        launchTimeout,
        "automator.launch"
      );
      const { elapsedMs } = await waitForReady(mp, { timeoutMs: readyTimeout });
      if (elapsedMs > 2000) {
        log(`[就绪] 模拟器 ${elapsedMs}ms 后可用`);
      }
      return mp;
    } catch (err) {
      lastErr = err;
      const msg = String((err && err.message) || err);
      log(`[启动] 第 ${i}/${attempts} 次失败：${msg.slice(0, 120)}`);
      if (i < attempts) {
        // 关键：IDE 2.x close() 不退进程，等待几乎必然超时，直接强杀拿干净实例
        await waitDevtoolsExited(8000);
        if (devtoolsRunning()) {
          log("[启动] DevTools 进程未退出（Electron 版 close 只关窗口），强制结束");
          killDevtools();
          await sleep(2500);
        }
        await sleep(1500);
      }
    }
  }
  throw new Error(
    `automator 启动 ${attempts} 次均失败：${lastErr ? lastErr.message : "未知错误"}`
  );
}

/**
 * 读导航宿主节点上的 data-* 属性。
 *
 * 为什么需要：IDE 2.x 起自定义组件内部节点位于 shadow 边界之后，automator 的
 * page.$("组件内部类名") 一律返回 null（automator 0.12 与 0.13 皆如此，官方无跨边界 API）。
 * 因此页面给 <WechatNav> 宿主加 .nav-anchor 并透传 data-nav-title / data-nav-back，
 * 宿主节点在页面侧可见，可正常断言。
 *
 * @param {{$: Function}} page  automator 的 page 对象
 * @returns {Promise<{found: boolean, title: string, back: boolean}>}
 */
async function navInfo(page) {
  const el = await page.$(".nav-anchor");
  if (!el) return { found: false, title: "", back: false };
  const title = (await el.attribute("data-nav-title")) || "";
  const back = (await el.attribute("data-nav-back")) === "1";
  return { found: true, title, back };
}

/** 安静关闭：close 也可能挂住，超时后忽略。 */
async function closeQuiet(mp, timeoutMs = 15000) {
  if (!mp) return;
  try {
    await withTimeout(mp.close(), timeoutMs, "miniProgram.close");
  } catch {
    /* 关闭失败不影响断言结论 */
  }
}

module.exports = {
  sleep,
  withTimeout,
  devtoolsRunning,
  killDevtools,
  waitDevtoolsExited,
  isNotReadyError,
  waitForReady,
  launchAndReady,
  navInfo,
  closeQuiet,
};
