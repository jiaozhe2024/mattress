/** 展示层格式化工具（纯函数，非法输入返回 '-'，不抛错） */

/** ISO 时间字符串 → 'YYYY-MM-DD HH:mm:ss'（本地时区）；null/非法值返回 '-' */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}
