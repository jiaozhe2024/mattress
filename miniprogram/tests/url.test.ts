import { describe, it, expect } from "vitest";
import {
  absoluteUrl,
  fitRichTextImages,
  inlineRichTextHeadings,
  normalizeRichText,
  rewriteRichTextImageSrc,
} from "@/utils/url";

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

describe("rewriteRichTextImageSrc（富文本内 <img> 相对路径补全）", () => {
  const BASE = "http://localhost:8000";

  it("相对路径 img 补全为绝对地址", () => {
    const html = '<p>x</p><img src="/uploads/demo/a.jpg" alt="a" />';
    expect(rewriteRichTextImageSrc(html, BASE)).toContain(
      'src="http://localhost:8000/uploads/demo/a.jpg"'
    );
  });

  it("已是 http(s) 的 img 不重复拼接", () => {
    const html = '<img src="https://cdn.example.com/a.jpg">';
    expect(rewriteRichTextImageSrc(html, BASE)).toBe(html);
  });

  it("data: 与 wxfile: 协议原样保留", () => {
    const dataUri = '<img src="data:image/png;base64,AAA">';
    expect(rewriteRichTextImageSrc(dataUri, BASE)).toBe(dataUri);
    const wxfile = '<img src="wxfile://tmp_abc.jpg">';
    expect(rewriteRichTextImageSrc(wxfile, BASE)).toBe(wxfile);
  });

  it("单引号与双引号都能处理", () => {
    const single = "<img src='/uploads/b.jpg'>";
    expect(rewriteRichTextImageSrc(single, BASE)).toContain(
      "http://localhost:8000/uploads/b.jpg"
    );
  });

  it("同时处理多张图", () => {
    const html = '<img src="/u/1.jpg"><p>t</p><img src="/u/2.jpg">';
    const out = rewriteRichTextImageSrc(html, BASE);
    expect(out).toContain("http://localhost:8000/u/1.jpg");
    expect(out).toContain("http://localhost:8000/u/2.jpg");
  });

  it("base 为空时原样返回，不产生 undefined 前缀", () => {
    const html = '<img src="/u/a.jpg">';
    expect(rewriteRichTextImageSrc(html, "")).toBe(html);
  });

  it("空串安全", () => {
    expect(rewriteRichTextImageSrc("", BASE)).toBe("");
  });

  it("不改动非 img 标签的属性", () => {
    const html = '<a href="/page">链接</a>';
    expect(rewriteRichTextImageSrc(html, BASE)).toBe(html);
  });
});

describe("inlineRichTextHeadings（h1~h4 内联小标题样式）", () => {
  it("h3 注入 Bold 18 navy 内联样式（spec §5.4 ⑤）", () => {
    const out = inlineRichTextHeadings("<h3>薄一点，也舒适一点</h3>");
    expect(out).toContain("font-size:18px");
    expect(out).toContain("font-weight:700");
    expect(out).toContain("color:#1a2260");
  });

  it("已有 style 属性时不覆盖（尊重运营自定义）", () => {
    const html = '<h3 style="color:red">标题</h3>';
    expect(inlineRichTextHeadings(html)).toBe(html);
  });

  it("h1/h2/h4 一并处理", () => {
    const out = inlineRichTextHeadings("<h1>a</h1><h2>b</h2><h4>c</h4>");
    expect(out.match(/font-size:18px/g)?.length).toBe(3);
  });

  it("p 等非标题标签不受影响", () => {
    const html = "<p>正文</p>";
    expect(inlineRichTextHeadings(html)).toBe(html);
  });

  it("空串安全", () => {
    expect(inlineRichTextHeadings("")).toBe("");
  });
});

describe("fitRichTextImages（富文本图片不自适应会出现「只露一部分」）", () => {
  it("无 style 的 img 注入宽度自适应", () => {
    const out = fitRichTextImages('<img src="http://x/a.jpg">');
    expect(out).toContain("max-width:100%");
    expect(out).toContain("width:100%");
    expect(out).toContain("height:auto");
  });

  it("空 style 的 img 同样注入（wangEditor 会产出 style=\"\"）", () => {
    const out = fitRichTextImages('<img src="http://x/a.jpg" style=""/>');
    expect(out).toMatch(/style="max-width:100%/);
  });

  it("已有 style 且无宽度声明时合并，不丢原样式", () => {
    const out = fitRichTextImages('<img src="http://x/a.jpg" style="border:1px solid #ccc">');
    expect(out).toContain("border:1px solid #ccc;");
    expect(out).toContain("max-width:100%");
  });

  it("运营显式设了 width 时不覆盖", () => {
    const html = '<img src="http://x/a.jpg" style="width:120px">';
    expect(fitRichTextImages(html)).toBe(html);
  });

  it("已设 max-width 时同样不覆盖", () => {
    const html = '<img src="http://x/a.jpg" style="max-width:50%">';
    expect(fitRichTextImages(html)).toBe(html);
  });

  it("多图全部处理，其它标签不碰", () => {
    const out = fitRichTextImages('<p>a</p><img src="1.jpg"><p>b</p><img src="2.jpg">');
    expect(out.match(/max-width:100%/g)?.length).toBe(2);
    expect(out).toContain("<p>a</p>");
  });

  it("空串安全", () => {
    expect(fitRichTextImages("")).toBe("");
  });
});

describe("normalizeRichText（渲染前统一规范化）", () => {
  it("同时补图片地址与标题样式", () => {
    const html = '<h3>标题</h3><img src="/uploads/a.jpg">';
    const out = normalizeRichText(html, "http://localhost:8000");
    expect(out).toContain("font-size:18px");
    expect(out).toContain("http://localhost:8000/uploads/a.jpg");
  });

  it("只含文字时安全", () => {
    const html = "<p>纯文字</p>";
    expect(normalizeRichText(html, "http://localhost:8000")).toBe(html);
  });

  it("空串安全", () => {
    expect(normalizeRichText("", "http://localhost:8000")).toBe("");
  });
});
