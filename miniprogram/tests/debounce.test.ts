import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { debounce } from "@/utils/debounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce（搜索 300ms 防抖核心逻辑）", () => {
  it("waitMs 内连续调用只触发最后一次，且携带最后一次参数", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced("卷");
    debounced("卷绵");
    debounced("卷绵时代");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("卷绵时代");
  });

  it("间隔超过 waitMs 的调用各自独立触发", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced("a");
    vi.advanceTimersByTime(300);
    debounced("b");
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, "a");
    expect(fn).toHaveBeenNthCalledWith(2, "b");
  });

  it("cancel：未触发的调用被取消，之后的新调用不受影响", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced("pending");
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    debounced("next");
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("next");
  });

  it("cancel 在无挂起定时器时调用不抛错（幂等）", () => {
    const debounced = debounce(vi.fn(), 300);
    expect(() => {
      debounced.cancel();
      debounced.cancel();
    }).not.toThrow();
  });
});
