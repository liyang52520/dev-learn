import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { clearSession, readSession, writeSession, type RatedEntry } from './session-store'
import type { Phase } from './types'

type Options = {
  phase: Phase
  reviewed: number
  /** 服务端 Anki 学习日；未加载时为空，暂不读写本地会话，避免用错日期。 */
  dayKey?: string
  setReviewed: Dispatch<SetStateAction<number>>
}

/** 本轮进度：本地存储恢复、计时分段与题目/撤销栈。 */
export function useSessionClock({ phase, reviewed, dayKey, setReviewed }: Options) {
  const [topics, setTopics] = useState<string[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [ratedThisTab, setRatedThisTab] = useState(0)
  const elapsedRef = useRef(0)
  const segmentRef = useRef<number | null>(null)
  const ratedIds = useRef<Set<number>>(new Set())
  const ratedOrder = useRef<RatedEntry[]>([])
  // 已经完成「恢复/清空」的学习日；在此之前不要写回，否则会把昨天的进度写到今天。
  const sessionDay = useRef('')

  const reset = useCallback(() => {
    setReviewed(0)
    setRatedThisTab(0)
    setTopics([])
    ratedIds.current = new Set()
    ratedOrder.current = []
    elapsedRef.current = 0
    setElapsedMs(0)
    segmentRef.current = null
  }, [setReviewed])

  useEffect(() => {
    if (!dayKey || sessionDay.current === dayKey) return
    sessionDay.current = dayKey
    const stored = readSession(dayKey)
    if (stored) {
      setReviewed(stored.reviewed)
      setTopics(stored.topics)
      ratedOrder.current = stored.stack || []
      ratedIds.current = new Set((stored.stack || []).map((entry) => entry.id))
      elapsedRef.current = stored.elapsedMs || 0
      setElapsedMs(stored.elapsedMs || 0)
      return
    }
    // 跨日（或本地没有当天的记录）：只有在还没开始评卡时才清零。
    // 统计比第一张卡晚到时不能把本轮进度抹掉。
    if (reviewed === 0) reset()
    clearSession()
  }, [dayKey, reviewed, reset, setReviewed])

  useEffect(() => {
    if (!dayKey || sessionDay.current !== dayKey) return
    if (phase !== 'question' && phase !== 'answer') return
    if (reviewed <= 0) {
      clearSession()
      return
    }
    writeSession({
      date: dayKey,
      reviewed,
      elapsedMs,
      topics,
      stack: ratedOrder.current,
    })
  }, [reviewed, elapsedMs, topics, phase, ratedThisTab, dayKey])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (segmentRef.current !== null) {
          elapsedRef.current += Date.now() - segmentRef.current
          segmentRef.current = null
        }
        setElapsedMs(elapsedRef.current)
      } else if (phase === 'question' || phase === 'answer') {
        segmentRef.current = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase])

  const flushSegment = useCallback(() => {
    if (segmentRef.current !== null) {
      elapsedRef.current += Date.now() - segmentRef.current
      segmentRef.current = Date.now()
    }
    // 每评一张就把用时落到 state，刷新后才能从 sessionStorage 恢复。
    setElapsedMs(elapsedRef.current)
    return elapsedRef.current
  }, [])

  return {
    topics,
    setTopics,
    elapsedMs,
    setElapsedMs,
    ratedThisTab,
    setRatedThisTab,
    elapsedRef,
    segmentRef,
    ratedIds,
    ratedOrder,
    flushSegment,
    reset,
  }
}
