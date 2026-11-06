import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { clearSession, readSession, todayIso, writeSession, type RatedEntry } from './session-store'
import type { Phase } from './types'

type Options = {
  phase: Phase
  reviewed: number
  setReviewed: Dispatch<SetStateAction<number>>
}

/** 本轮进度：本地存储恢复、计时分段与题目/撤销栈。 */
export function useSessionClock({ phase, reviewed, setReviewed }: Options) {
  const [topics, setTopics] = useState<string[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [ratedThisTab, setRatedThisTab] = useState(0)
  const elapsedRef = useRef(0)
  const segmentRef = useRef<number | null>(null)
  const ratedIds = useRef<Set<number>>(new Set())
  const ratedOrder = useRef<RatedEntry[]>([])

  useEffect(() => {
    const stored = readSession()
    if (!stored) return
    setReviewed(stored.reviewed)
    setTopics(stored.topics)
    ratedOrder.current = stored.stack || []
    ratedIds.current = new Set((stored.stack || []).map((entry) => entry.id))
    elapsedRef.current = stored.elapsedMs || 0
    setElapsedMs(stored.elapsedMs || 0)
  }, [setReviewed])

  useEffect(() => {
    if (phase !== 'question' && phase !== 'answer') return
    if (reviewed <= 0) {
      clearSession()
      return
    }
    writeSession({
      date: todayIso(),
      reviewed,
      elapsedMs,
      topics,
      stack: ratedOrder.current,
    })
  }, [reviewed, elapsedMs, topics, phase, ratedThisTab])

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
