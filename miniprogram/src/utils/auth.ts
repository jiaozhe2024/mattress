import { post } from "./request";
import { setToken } from "./token";

// dev/自动化环境：不调用真实 wx.login，用固定测试 code，后端 code2session 返回固定测试 openid（AGENTS.md 约定 4）
const USE_WX_MOCK: boolean = String(import.meta.env.VITE_USE_WX_MOCK) === "true";
const MOCK_WX_CODE = "dev-mock-wx-code-0001";

export interface LoginResponse {
  token: string;
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
  setToken(data.token);
}