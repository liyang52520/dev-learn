/** 本轮复习的本地暂存：刷新页面后仍能看到本轮计数，撤销栈也只回退自己评过的卡。 */

const KEY = 'yg-review-session'

export interface RatedEntry {
  id: number
  /** 这次评分是否让「本轮已评」+1（同一张卡重复出现时只有第一次算） */
  counted: boolean
}

export interface StoredSession {
  date: string
  reviewed: number
  elapsedMs: number
  topics: string[]
  stack: RatedEntry[]
}

/** 只有和当前 Anki 学习日一致才恢复；0:00–4:00 之间刷新不会被误清。 */
export function readSession(dayKey: string): StoredSession | null {
  if (!dayKey) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredSession
    return parsed.date === dayKey ? parsed : null
  } catch {
    return null
  }
}

export function writeSession(session: StoredSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    /* 隐私模式写不了，忽略 */
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}
