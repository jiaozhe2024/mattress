import { post } from "./request";
import { setToken } from "./token";

// dev/自动化环境：不调用真实 wx.login，用固定测试 code，后端 code2session 返回固定测试 openid（AGENTS.md 约定 4）
const USE_WX_MOCK: boolean = String(import.meta.env.VITE_USE_WX_MOCK) === "true";
const MOCK_WX_CODE = "dev-mock-wx-code-0001";

export interface LoginResponse {
  /** 后端 WxLoginResponse 字段名是 access_token（OAuth2 风格），不是 token。 */
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
}

function wxLoginCode(): Promise<string> {
  if (USE_WX_MOCK) {
    return Promise.resolve(MOCK_WX_CODE);
  }
  return new Promise((resolve, reject) => {
    uni.login({
      success: (res) => {
        if (res.code) {
          resolve(res.code);
        } else {
          reject(new Error("wx.login 未返回 code"));
        }
      },
      fail: (err) => {
        reject(new Error(`wx.login 失败: ${err.errMsg}`));
      },
    });
  });
}

export async function silentLogin(): Promise<void> {
  const code = await wxLoginCode();
  const data = await post<LoginResponse>(
    "/wxapi/auth/login",
    { code },
    { silent: true }
  );
  // 后端字段是 access_token；此前误读 data.token 导致存进 storage 的是 undefined，
  // 于是每个业务请求都 401、重登也存不进 token，表现为「保存：缺少登录凭证」死循环。
  if (!data || typeof data.access_token !== "string" || data.access_token === "") {
    throw new Error("登录响应缺少 access_token");
  }
  setToken(data.access_token);
}