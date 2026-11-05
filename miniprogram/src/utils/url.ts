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
