import { getToken, clearToken } from "./token";

export interface ApiResponse<T> {
  code: number;
  msg: string;
  data: T;
}

type RequestData = UniApp.RequestOptions["data"];

// url/method 由 get/post/put/del 注入，调用方只需传 data/silent 等可选配置
export interface RequestConfig extends Partial<UniApp.RequestOptions> {
  // silent=true 时不弹统一错误 toast（如静默登录失败）
  silent?: boolean;
}

type ReloginHandler = () => Promise<void>;

let reloginHandler: ReloginHandler | null = null;
let reloginInFlight: Promise<boolean> | null = null;

/**
 * 启动登录就绪 Promise。
 *
 * 为什么需要：App.vue 的 onLaunch 里 silentLogin() 是异步且不阻塞的，而首页
 * 组件的 onLoad 会立刻发请求，此刻 storage 里还没有 token，于是必然 401。
 * 让业务请求先 await 这个 Promise，可以避免「首屏请求必失败 + 依赖 401 重试」
 * 的脆弱链路（保存等写操作在重试链路上曾出现「缺少登录凭证」）。
 */
let authReady: Promise<unknown> | null = null;

/** 由 App.vue 在启动时注入：首个业务请求会等它落定（成功或失败都不阻塞）。 */
export function setAuthReady(promise: Promise<unknown>): void {
  authReady = promise;
}

export function setReloginHandler(handler: ReloginHandler): void {
  reloginHandler = handler;
}

export class RequestError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public body?: ApiResponse<unknown>
  ) {
    super(message);
    this.name = "RequestError";
  }
}

function baseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string) ?? "";
}

function showError(msg: string): void {
  uni.showToast({ title: msg, icon: "none" });
}

async function ensureRelogin(): Promise<boolean> {
  if (!reloginHandler) return false;
  if (!reloginInFlight) {
    reloginInFlight = reloginHandler()
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        reloginInFlight = null;
      });
  }
  return reloginInFlight;
}

function rawRequest<T>(
  config: UniApp.RequestOptions
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    uni.request({
      ...config,
      url: baseUrl() + config.url,
      success: (res) => {
        const httpCode = res.statusCode;
        const body = res.data as ApiResponse<T>;
        const bodyCode =
          body && typeof body.code === "number" ? body.code : undefined;
        if (httpCode === 200 && bodyCode === 200) {
          resolve(body);
          return;
        }
        // HTTP 失败用 HTTP 码；HTTP 200 但业务码非 200 用业务码（401 同样触发重登）
        const effCode =
          httpCode !== 200 ? httpCode : bodyCode !== undefined ? bodyCode : -1;
        reject(
          new RequestError(
            (body && body.msg) || `请求失败(${effCode})`,
            effCode,
            body
          )
        );
      },
      fail: (err) => {
        reject(
          new RequestError(err.errMsg || "网络异常", -1)
        );
      },
    });
  });
}

async function request<T>(
  config: RequestConfig & { url: string; method: "GET" | "POST" | "PUT" | "DELETE" },
  isRetry = false
): Promise<T> {
  // 首个业务请求等启动登录落定：避免「无 token 必 401」的不必要往返。
  // 失败也不阻塞（后端未起时仍让请求走下去，由错误处理兜底）。
  if (authReady !== null) {
    const pending = authReady;
    authReady = null;
    await pending.catch(() => undefined);
  }
  const token = getToken();
  const header: Record<string, string> = { ...(config.header as Record<string, string> | undefined) };
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }
  try {
    const body = await rawRequest<T>({ ...config, header });
    return body.data;
  } catch (err) {
    const reqErr = err instanceof RequestError ? err : new RequestError("请求失败", -1);
    if (reqErr.statusCode === 401) {
      clearToken();
      // 401 → 一次静默重登后重试
      if (!isRetry && (await ensureRelogin())) {
        return request<T>(config, true);
      }
    }
    if (!config.silent) {
      showError(reqErr.message);
    }
    throw reqErr;
  }
}

export function get<T>(
  url: string,
  data?: RequestData,
  config: RequestConfig = {}
): Promise<T> {
  return request<T>({ ...config, url, data, method: "GET" });
}

export function post<T>(
  url: string,
  data?: RequestData,
  config: RequestConfig = {}
): Promise<T> {
  return request<T>({ ...config, url, data, method: "POST" });
}

export function put<T>(
  url: string,
  data?: RequestData,
  config: RequestConfig = {}
): Promise<T> {
  return request<T>({ ...config, url, data, method: "PUT" });
}

export function del<T>(
  url: string,
  data?: RequestData,
  config: RequestConfig = {}
): Promise<T> {
  return request<T>({ ...config, url, data, method: "DELETE" });
}