/**
 * jsdom 内联样式断言辅助
 *
 * jsdom 会把 Vue 写入的 style 字符串规范化：
 *   - `padding-top:44px` → `padding-top: 44px`
 *   - `background:#1a2260` → `background: rgb(26, 34, 96)`
 *   - 不识别 rpx 单位 → 整条声明被丢弃
 * 因此断言读取 `element.style`，并用本文件把设计稿 hex 换算成 jsdom 的 rgb 形式。
 */

/** 读取元素内联样式（jsdom 已解析）。 */
export function styleOf(el: Element): CSSStyleDeclaration {
  return (el as HTMLElement).style;
}

/** #rrggbb → jsdom 的 "rgb(r, g, b)"。 */
export function rgb(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`rgb() 仅支持 #rrggbb，收到: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}
