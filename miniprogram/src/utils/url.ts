const DEFAULT_ASSET_BASE: string =
  (import.meta.env.VITE_ASSET_BASE_URL as string | undefined) ?? "";

/**
 * 后端图片字段为相对路径（/uploads/demo/...，OSS 适配层落地前的本地 mock），
 * 小程序 <image> 需要绝对地址，这里按 VITE_ASSET_BASE_URL 补全。
 */
export function absoluteUrl(path: string, base: string = DEFAULT_ASSET_BASE): string {
  if (/^https?:\/\//i.test(path)) return path;
  const trimmedBase = base.replace(/\/+$/, "");
  if (trimmedBase === "" || path === "") return trimmedBase || path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return trimmedBase + normalizedPath;
}

/**
 * 富文本内的相对图片路径补全。
 *
 * 为什么需要：后端 detail_content 由运营在 wangEditor 里维护，图片存的是
 * 相对路径（`/uploads/...`）。`<rich-text>` 的 nodes 不会被小程序自动补 base，
 * 真机上这些图会全部不显示（web 端 dev server 有同源代理，看不出来）。
 *
 * 只重写 <img> 的 src，不碰其他标签与已经是 http(s)/data 的地址。
 */
export function rewriteRichTextImageSrc(
  html: string,
  base: string = DEFAULT_ASSET_BASE
): string {
  if (html === "" || base === "") return html;
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, src: string) => {
      if (/^(https?:|data:|wxfile:)/i.test(src)) return match;
      return `${prefix}${quote}${absoluteUrl(src, base)}${quote}`;
    }
  );
}

/**
 * 富文本标题样式内联。
 *
 * 为什么需要：spec §5.4 ⑤ 要求产品说明的小标题为 Bold 18px navy，但
 * `<rich-text>` 内部的 h1~h4 不受页面 scoped CSS 影响（小程序会隔离样式），
 * 只能把样式内联进节点 HTML。
 */
export function inlineRichTextHeadings(
  html: string,
  style = "font-size:18px;font-weight:700;line-height:1.45;color:#1a2260;margin:0;"
): string {
  if (html === "") return html;
  return html.replace(/<(h[1-4])(\s[^>]*)?>/gi, (match, tag: string, attrs = "") => {
    // 已有 style 属性则不重复注入，避免覆盖运营自定义样式
    if (/\bstyle\s*=/i.test(attrs)) return match;
    return `<${tag}${attrs} style="${style}">`;
  });
}

/**
 * 富文本图片自适应容器宽度。
 *
 * 为什么需要：rich-text 里的 <img> 不指定宽度时按图片原始像素渲染
 * （运营上传的 1440×1800 原图会把容器撑爆，只露出一部分），而 scoped CSS
 * 管不到 rich-text 内部节点。只能把宽度约束内联进节点 HTML。
 *
 * 已有 width/max-width 声明的图不覆盖——运营显式设定尺寸时以他的为准。
 */
const IMG_FIT_STYLE = "max-width:100%;width:100%;height:auto;display:block;";

export function fitRichTextImages(html: string): string {
  if (html === "") return html;
  return html.replace(/<img\b[^>]*>/gi, (tag: string) => {
    const styleMatch = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i.exec(tag);
    if (styleMatch) {
      const existing = styleMatch[2];
      if (/\b(width|max-width)\s*:/i.test(existing)) return tag;
      const sep = existing.trim() === "" || /;\s*$/.test(existing) ? "" : ";";
      const merged = `${existing}${sep}${IMG_FIT_STYLE}`;
      return tag.replace(styleMatch[0], `style=${styleMatch[1]}${merged}${styleMatch[1]}`);
    }
    return tag.replace(/<img\b/i, `<img style="${IMG_FIT_STYLE}"`);
  });
}

/**
 * 富文本渲染前的统一规范化：补全图片绝对地址 + 图片宽度自适应 + 标题样式内联。
 */
export function normalizeRichText(
  html: string,
  base: string = DEFAULT_ASSET_BASE
): string {
  return inlineRichTextHeadings(fitRichTextImages(rewriteRichTextImageSrc(html, base)));
}
