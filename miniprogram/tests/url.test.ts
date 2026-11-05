import { describe, it, expect } from "vitest";
import { absoluteUrl } from "@/utils/url";

describe("absoluteUrl（后端返回的 /uploads/... 相对路径补全）", () => {
  it("已是 http(s) 绝对地址时原样返回", () => {
    expect(absoluteUrl("https://cdn.example.com/a.png", "http://localhost:8000")).toBe(
      "https://cdn.example.com/a.png"
    );
  });

  it("相对路径拼接 base", () => {
    expect(absoluteUrl("/uploads/demo/banner.jpg", "http://localhost:8000")).toBe(
      "http://localhost:8000/uploads/demo/banner.jpg"
    );
  });

  it("base 带尾斜杠不产生双斜杠", () => {
    expect(absoluteUrl("/uploads/a.jpg", "http://localhost:8000/")).toBe(
      "http://localhost:8000/uploads/a.jpg"
    );
  });

  it("相对路径缺首斜杠时自动补", () => {
    expect(absoluteUrl("uploads/a.jpg", "http://localhost:8000")).toBe(
      "http://localhost:8000/uploads/a.jpg"
    );
  });

  it("base 为空时原样返回（避免拼出 undefined 前缀）", () => {
    expect(absoluteUrl("/uploads/a.jpg", "")).toBe("/uploads/a.jpg");
  });

  it("空路径返回 base 或空串，不抛错", () => {
    expect(absoluteUrl("", "http://localhost:8000")).toBe("http://localhost:8000");
    expect(absoluteUrl("", "")).toBe("");
  });
});
