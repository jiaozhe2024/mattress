import { vi, describe, it, expect, beforeEach } from "vitest";
import { post, setReloginHandler, RequestError } from "@/utils/request";
import { setToken, clearToken } from "@/utils/token";

const storage = new Map<string, string>();

vi.stubGlobal("uni", {
  request: vi.fn(),
  showToast: vi.fn(),
  getStorageSync: (k: string) => storage.get(k) ?? "",
  setStorageSync: (k: string, v: unknown) => storage.set(k, String(v)),
  removeStorageSync: (k: string) => storage.delete(k),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const uni = (globalThis as any).uni;

type Responder = () => { statusCode: number; data: unknown } | null;
let responder: Responder;

beforeEach(() => {
  vi.clearAllMocks();
  storage.clear();
  clearToken();
  responder = () => null;
  uni.request.mockImplementation((opts: {
    success: (res: unknown) => void;
    fail: (err: { errMsg: string }) => void;
  }) => {
    const res = responder();
    if (res) {
      opts.success(res);
    } else {
      opts.fail({ errMsg: "request:fail mock-network" });
    }
  });
});

describe("request 封装", () => {
  it("成功响应：解包 data，拼接 baseURL，无 token 不带 Authorization", async () => {
    responder = () => ({
      statusCode: 200,
      data: { code: 200, msg: "ok", data: { id: 1 } },
    });
    const result = await post<{ id: number }>("/test", { a: 1 });
    expect(result.id).toBe(1);
    const opts = uni.request.mock.calls[0][0];
    expect(opts.url).toBe("http://test-api/test");
    expect(opts.method).toBe("POST");
    expect(opts.data).toEqual({ a: 1 });
    expect(opts.header.Authorization).toBeUndefined();
  });

  it("token 注入：存在 token 时请求头带 Bearer Authorization", async () => {
    setToken("jwt-abc");
    responder = () => ({
      statusCode: 200,
      data: { code: 200, msg: "ok", data: { ok: true } },
    });
    await post("/test");
    const opts = uni.request.mock.calls[0][0];
    expect(opts.header.Authorization).toBe("Bearer jwt-abc");
  });

  it("业务码 401：清 token → 调 relogin → 自动重试一次并成功", async () => {
    let calls = 0;
    let reloginCalled = false;
    setReloginHandler(async () => {
      reloginCalled = true;
      setToken("jwt-new");
    });
    responder = () => {
      calls += 1;
      if (calls === 1) {
        return { statusCode: 200, data: { code: 401, msg: "未登录", data: null } };
      }
      return {
        statusCode: 200,
        data: { code: 200, msg: "ok", data: { ok: true } },
      };
    };
    const result = await post<{ ok: boolean }>("/test");
    expect(reloginCalled).toBe(true);
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("HTTP 401：同样触发重登重试", async () => {
    let calls = 0;
    setReloginHandler(async () => {
      setToken("jwt-new");
    });
    responder = () => {
      calls += 1;
      if (calls === 1) {
        return { statusCode: 401, data: { code: 401, msg: "未登录", data: null } };
      }
      return {
        statusCode: 200,
        data: { code: 200, msg: "ok", data: { ok: true } },
      };
    };
    const result = await post<{ ok: boolean }>("/test");
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  it("重登后仍 401：不再无限重试，非 silent 时弹错误 toast", async () => {
    let calls = 0;
    setReloginHandler(async () => {});
    responder = () => {
      calls += 1;
      return { statusCode: 200, data: { code: 401, msg: "登录失效", data: null } };
    };
    await expect(post("/x")).rejects.toBeInstanceOf(RequestError);
    expect(calls).toBe(2);
    expect(uni.showToast).toHaveBeenCalledWith({ title: "登录失效", icon: "none" });
  });

  it("silent 配置：登录失败重试后不再弹 toast", async () => {
    setReloginHandler(async () => {});
    responder = () => ({ statusCode: 200, data: { code: 401, msg: "未登录", data: null } });
    await expect(post("/x", undefined, { silent: true })).rejects.toThrow();
    expect(uni.showToast).not.toHaveBeenCalled();
  });

  it("业务码 500：非 401 不触发重登，抛 RequestError 并 toast msg", async () => {
    let calls = 0;
    setReloginHandler(async () => {
      calls = 100;
    });
    responder = () => {
      calls += 1;
      return { statusCode: 200, data: { code: 500, msg: "服务器错误", data: null } };
    };
    await expect(post("/x")).rejects.toBeInstanceOf(RequestError);
    expect(calls).toBe(1);
    expect(uni.showToast).toHaveBeenCalledWith({ title: "服务器错误", icon: "none" });
  });

  it("网络失败：走 fail 分支，抛错并 toast", async () => {
    responder = () => null;
    await expect(post("/x")).rejects.toBeInstanceOf(RequestError);
    expect(uni.showToast).toHaveBeenCalledWith({ title: "request:fail mock-network", icon: "none" });
  });
});