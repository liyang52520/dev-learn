/** 唯一的 HTTP 封装：所有 feature 的 api.ts 都只能用这里的函数。 */

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

function withQuery(path: string, query?: Query): string {
  if (!query) return path
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `${path}?${text}` : path
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text()
  const data: unknown = text ? JSON.parse(text) : null
  if (!response.ok) {
    const body = data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'http_error',
      body?.error?.message ?? '请求失败',
      body?.error?.fields ?? {},
    )
  }
  return data as T
}

export async function apiGet<T>(path: string, query?: Query): Promise<T> {
  const response = await fetch(withQuery(path, query), {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  return parse<T>(response)
}

export async function apiSend<T>(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return parse<T>(response)
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  return parse<T>(response)
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return '未知错误'
}
