/**
 * E2E 公共工具：自动探测微信开发者工具的自动化服务端口。
 *
 * 为什么需要这个模块：
 * miniprogram-automator 的 launch() 需要 IDE 开启「服务端口」，但**端口号不是固定的**
 * —— 开发者工具首次启动会随机分配并写进本地配置
 * (`wechatwebdevtools/.../WeappLocalData/localstorage_*.json` 的 security.port)。
 * 早期脚本把端口硬编码成 9420，机器实际分配的是别的号（如 64343）时会一直报
 * "端口未开启"，让人误判成「服务端口没开」而去手点开关。
 *
 * 探测顺序：
 *   1. 环境变量 WX_AUTOMATION_PORT（显式覆盖，CI 用）
 *   2. DevTools 配置文件里的 security.port（且 enableServicePort 为 true）
 *   3. 常见默认端口兜底（9420 / 64343）
 * 全部探不到才判定环境阻塞。
 *
 * 用法：
 *   const { resolveAutomationPort } = require("./_automationPort");
 *   const port = await resolveAutomationPort();
 *   if (port === null) { ...环境阻塞退出 2 }
 */
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");

/** 开发者工具配置根目录（macOS）。其他平台返回 []。 */
function devtoolsDataDirs() {
  if (process.platform !== "darwin") return [];
  const base = path.join(
    os.homedir(),
    "Library",
    "Application Support",
    "微信开发者工具"
  );
  try {
    return fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^[0-9a-f]{32}$/i.test(d.name))
      .map((d) => path.join(base, d.name, "WeappLocalData"));
  } catch {
    return [];
  }
}

/** 从 DevTools 的 localstorage 快照里读出 security 配置。 */
function readSecurityConfig() {
  for (const dir of devtoolsDataDirs()) {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.startsWith("localstorage_"));
    } catch {
      continue;
    }
    for (const name of files) {
      const file = path.join(dir, name);
      let raw;
      try {
        raw = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      // 只解析含 security 的少量文件，避免逐个大文件 JSON.parse
      if (!raw.includes('"security"') || !raw.includes("enableServicePort")) {
        continue;
      }
      try {
        const obj = JSON.parse(raw);
        if (obj && obj.security && typeof obj.security === "object") {
          return {
            enabled: obj.security.enableServicePort === true,
            port: Number(obj.security.port) || null,
          };
        }
      } catch {
        /* 跳过损坏文件 */
      }
    }
  }
  return null;
}

/** TCP 探测端口是否真的在监听。 */
function probePort(port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

/**
 * 解析可用的自动化端口。
 * @returns {Promise<{port: number|null, source: string, note: string}>}
 */
async function resolveAutomationPort() {
  const candidates = [];
  const envPort = Number(process.env.WX_AUTOMATION_PORT);
  if (Number.isFinite(envPort) && envPort > 0) {
    candidates.push({ port: envPort, source: "env:WX_AUTOMATION_PORT" });
  }

  const security = readSecurityConfig();
  if (security && security.enabled && security.port) {
    candidates.push({ port: security.port, source: "devtools:security.port" });
  } else if (security && security.enabled === false) {
    // 配置明确关掉了服务端口，直接给结论，不用再试默认值
    return {
      port: null,
      source: "devtools:security",
      note: "开发者工具「设置-安全设置-服务端口」处于关闭状态",
    };
  }

  for (const port of [9420, 64343]) {
    candidates.push({ port, source: `fallback:${port}` });
  }

  for (const c of candidates) {
    if (await probePort(c.port)) {
      return { port: c.port, source: c.source, note: "" };
    }
  }

  return {
    port: null,
    source: "none",
    note: security
      ? `配置端口 ${security.port ?? "未知"} 与兜底端口均未监听`
      : "未找到开发者工具配置，且兜底端口未监听",
  };
}

module.exports = { resolveAutomationPort, probePort, readSecurityConfig };
