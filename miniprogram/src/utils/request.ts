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