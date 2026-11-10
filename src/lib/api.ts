import axios, { type AxiosRequestConfig } from 'axios'
import type { ApiErrorBody } from '../contracts'

const TOKEN_KEY = 'aether.session'
export const currentToken = () => sessionStorage.getItem(TOKEN_KEY)
export function storeToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  readonly code: string
  readonly fields?: Record<string, string>
  readonly details?: ApiErrorBody['details']

  constructor(readonly status: number, data: ApiErrorBody) {
    super(data.message)
    this.name = 'ApiError'
    this.code = data.code
    this.fields = data.fields
    this.details = data.details
  }
}

let unauthorized: (token: string) => void = () => undefined
export function onUnauthorized(handler: (token: string) => void) {
  unauthorized = handler
}

const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 5000 })
client.interceptors.request.use((request) => {
  const token = currentToken()
  if (token) request.headers.set('Authorization', `Bearer ${token}`)
  return request
}, undefined, { synchronous: true })
client.interceptors.response.use(undefined, (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorBody>(error) || axios.isCancel(error)) return Promise.reject(error)
  const status = error.response?.status ?? 0
  const authorization = error.config?.headers.get('Authorization')
  if (status === 401 && typeof authorization === 'string' && !/\/session\/(login|register)$/.test(error.config?.url ?? '')) {
    unauthorized(authorization.slice(7))
  }
  const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
  return Promise.reject(new ApiError(status, error.response?.data?.message ? error.response.data : {
    code: timedOut ? 'TIMEOUT' : status ? 'HTTP_ERROR' : 'NETWORK_ERROR',
    message: timedOut ? 'A solicitação demorou demais. Tente novamente.' : status
      ? 'Não foi possível concluir a solicitação.' : 'Não foi possível conectar. Verifique sua conexão.',
  }))
})

export const api = {
  get: async <T>(url: string, signal?: AbortSignal) => (await client.get<T>(url, { signal })).data,
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => (await client.post<T>(url, body, config)).data,
  put: async <T>(url: string, body?: unknown) => (await client.put<T>(url, body)).data,
  patch: async <T>(url: string, body?: unknown) => (await client.patch<T>(url, body)).data,
  delete: async <T>(url: string) => (await client.delete<T>(url)).data,
}
