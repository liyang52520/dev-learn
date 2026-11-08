import { beforeEach, describe, expect, it } from 'vitest'

import { clearSession, readSession, writeSession } from './session-store'

const session = {
  date: '2026-11-08',
  reviewed: 3,
  elapsedMs: 1200,
  topics: ['jvm'],
  stack: [{ id: 7, counted: true }],
}

describe('复习会话暂存', () => {
  beforeEach(() => sessionStorage.clear())

  it('只恢复同一 Anki 学习日的记录', () => {
    writeSession(session)

    expect(readSession('2026-11-08')?.reviewed).toBe(3)
    expect(readSession('2026-11-09')).toBeNull()
  })

  it('学习日未知时不恢复，避免 0:00–4:00 刷新被误清', () => {
    writeSession(session)

    expect(readSession('')).toBeNull()
  })

  it('清空后不再返回', () => {
    writeSession(session)
    clearSession()

    expect(readSession('2026-11-08')).toBeNull()
  })
})
