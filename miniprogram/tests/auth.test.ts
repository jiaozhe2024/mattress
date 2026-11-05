import { vi, describe, it, expect, beforeEach } from "vitest";
import { silentLogin } from "@/utils/auth";
import { getToken, clearToken } from "@/utils/token";

const storage = new Map<string, string>();

vi.stubGlobal("uni", {
  request: vi.fn(),
  login: vi.fn(),
  showToast: vi.fn(),
  getStorageSync: (k: string) => storage.get(k) ?? "",
  setStorageSync: (k: string, v: unknown) => storage.set(k, String(v)),
  removeStorageSync: (k: string) => storage.delete(k),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uni = (globalThis as any).uni;

beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  clearToken();
});

describe("silentLogin（dev-mock 静默登录链路）", () => {
  it("mock 模式下用固定测试 code 请求 /wxapi/auth/login，成功后落地 token", async () => {
    uni.request.mockImplementation((opts: {
      url: string;
      data: { code: string };
      header: Record<string, string>;
      success: (res: unknown) => void;
    }) => {
      expect(opts.url).toBe("http://test-api/wxapi/auth/login");
      expect(opts.data).toEqual({ code: "dev-mock-wx-code-0001" });
      // 登录接口本身不带 token
      expect(opts.header.Authorization).toBeUndefined();
      opts.success({
        statusCode: 200,
        data: { code: 200, msg: "ok", data: { token: "jwt-test-token" } },
      });
    });
    await silentLogin();
    expect(getToken()).toBe("jwt-test-token");
  });

  it("登录接口返回非 200 业务码时抛错，不写 token", async () => {
    uni.request.mockImplementation((opts: {
      success: (res: unknown) => void;
    }) => {
      opts.success({
        statusCode: 200,
        data: { code: 500, msg: "登录失败", data: null },
      });
    });
    await expect(silentLogin()).rejects.toThrow();
    expect(getToken()).toBe("");
  });
});