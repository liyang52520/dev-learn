import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, apiGet, apiSend, errorMessage } from './client'

function mockFetch(status: number, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiGet', () => {
  it('拼接查询参数并丢掉空值', async () => {
    const spy = mockFetch(200, { items: [] })
    await apiGet('/api/posts', { page: 2, q: '', limit: undefined, draft: false })
    expect(spy).toHaveBeenCalledWith('/api/posts?page=2&draft=false', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
  })

  it('没有参数时不加问号', async () => {
    const spy = mockFetch(200, [])
    await apiGet('/api/study')
    expect(spy.mock.calls[0][0]).toBe('/api/study')
  })
})

describe('错误形状', () => {
  it('把后端 error 包成 ApiError', async () => {
    mockFetch(404, { error: { code: 'not_found', message: '题目不存在', fields: { qid: 'x' } } })
    const error = await apiGet('/api/study/jvm/x').catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(404)
    expect(apiError.code).toBe('not_found')
    expect(apiError.message).toBe('题目不存在')
    expect(apiError.fields).toEqual({ qid: 'x' })
    expect(errorMessage(error)).toBe('题目不存在')
  })

  it('非 JSON 错误回退到通用文案', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('') }),
    )
    const error = await apiGet('/api/health').catch((reason: unknown) => reason)
    expect((error as ApiError).code).toBe('http_error')
    expect((error as ApiError).message).toBe('请求失败')
  })
})

describe('apiSend', () => {
  it('POST 以 JSON 发送并带同源凭证', async () => {
    const spy = mockFetch(200, { ok: true })
    const result = await apiSend('POST', '/api/admin/auth/login', { password: 'x' })
    expect(result).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledWith('/api/admin/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ password: 'x' }),
    })
  })
})
