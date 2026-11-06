import { useCallback, useRef, useState } from 'react'

import type { ReviewProgress, ReviewStats } from '@/types/models'

import { fetchStats } from './api'

/** 统计只用于顶部进度与结束页；拉取失败不影响继续复习。 */
export function useReviewStats() {
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const lastAt = useRef(0)

  const loadStats = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastAt.current < 4000) return
    lastAt.current = now
    try {
      setStats(await fetchStats())
    } catch {
      /* 统计拿不到不影响复习 */
    }
  }, [])

  const applyProgress = useCallback((next?: ReviewProgress) => {
    if (!next) return
    setStats((previous) => (previous ? { ...previous, ...next } : previous))
  }, [])

  return { stats, loadStats, applyProgress }
}
