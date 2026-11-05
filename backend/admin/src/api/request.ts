import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'

import type { ApiEnvelope } from '@/types/api'
import { clearTokens, getAccessToken } from '@/utils/storage'

/**
 * axios 统一封装（BE-03 骨架）：
 * - baseURL：默认 http://localhost:8000/api/v1（.env 可覆盖）
 * - 请求拦截：注入 Bearer token
 * - 响应拦截：拆统一信封 {code,msg,data}，非 200 走错误分支
 * - 401：清空 token 并跳回登录页（整页跳转，避免与 router/store 循环依赖）
 * - 其余错误：ElMessage 统一 toast
 */
const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 15000,
})

http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** 提取后端错误文案：信封 msg（Fail）或 FastAPI detail（HTTPException 兜底） */
function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.msg === 'string' && d.msg) return d.msg
    if (typeof d.detail === 'string' && d.detail) return d.detail
  }
  return fallback
}

function redirectToLogin(): void {
  clearTokens()
  const current = window.location.pathname + window.location.search
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = `/login?redirect=${encodeURIComponent(current)}`
  }
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<unknown>) => {
    const status = error.response?.status
    if (status === 401) {
      // token 缺失/无效/过期：清 token 跳登录
      redirectToLogin()
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(error)
    }
    const fallback =
      status === 403
        ? '没有权限执行该操作'
        : error.code === 'ECONNABORTED'
          ? '请求超时，请稍后重试'
          : '网络请求失败，请检查后端服务是否启动'
    const message = error.response
      ? extractErrorMessage(error.response.data, fallback)
      : fallback
    ElMessage.error(message)
    return Promise.reject(error)
  },
)

/** 业务层请求入口：成功返回信封 data，失败抛出（错误 toast 已由拦截器统一处理） */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<ApiEnvelope<T>>(config)
  const envelope = response.data
  if (envelope.code !== 200) {
    // Fail 信封理论上不会以 HTTP 200 返回，这里做防御性兜底
    ElMessage.error(envelope.msg || '请求失败')
    throw new Error(envelope.msg || `业务错误码 ${envelope.code}`)
  }
  return envelope.data
}

export default http
