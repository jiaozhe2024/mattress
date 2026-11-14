/**
 * lucide 线性图标 path 集合 + 内联 SVG 生成（无第三方图标包，避免小程序包体膨胀）
 *
 * 说明：微信小程序 WXML 不支持 <svg> 标签，故 Icon.vue 将这里拼出的 SVG
 * 以 data:image/svg+xml;charset=utf-8,<encoded> 交给 <image> 渲染；
 * 仍是「内联 SVG」，不增加网络/包体依赖。原生 custom-tab-bar（WXML）
 * 用的是 scripts/gen-tabbar-icons.ts 由同一套 path 预渲染的 PNG。
 *
 * 图标名与 docs/design/design-spec/asset-inventory.md 一一对应。
 */

/** lucide 24×24 视图下的内部图形（stroke 属性由 generateIconSvg 统一设置）。 */
export const ICON_PATHS: Readonly<Record<string, string>> = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  "undo-2": '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  "chevron-left": '<path d="m15 18-6-6 6-6"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  "qr-code": '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  "message-circle": '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  newspaper:
    '<path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>',
};

export type IconName = keyof typeof ICON_PATHS;

/** 全部图标名（供测试与文档核对）。 */
export const ICON_NAMES: readonly string[] = Object.keys(ICON_PATHS);

export interface IconOptions {
  size?: number;
  color?: string;
  /** 线宽（lucide 默认 2）。 */
  strokeWidth?: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 生成 SVG 字符串。未知图标返回空图形（不抛错，避免页面因图标名拼错白屏）。
 */
export function generateIconSvg(name: string, options: IconOptions = {}): string {
  const size = options.size ?? 24;
  const color = options.color ?? "#1e2330";
  const strokeWidth = options.strokeWidth ?? 2;
  const body = ICON_PATHS[name] ?? "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${escapeXml(color)}" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">` +
    body +
    `</svg>`
  );
}

/** SVG → data URI（微信 <image> 可直接渲染）。 */
export function iconDataUri(name: string, options: IconOptions = {}): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    generateIconSvg(name, options)
  )}`;
}

/**
 * 图标盒尺寸样式：设计 px → rpx（750 设计宽，1px = 2rpx）。
 * 单独抽出便于单测：jsdom 不识别 rpx 单位，无法从渲染后的 style 属性回读。
 */
export function iconBoxStyle(size: number): string {
  const rpx = size * 2;
  return `width:${rpx}rpx;height:${rpx}rpx;`;
}
