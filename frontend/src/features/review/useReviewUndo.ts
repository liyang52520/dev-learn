import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import { ApiError, errorMessage } from '@/shared/api/client'
import type { ReviewCounts, ReviewProgress } from '@/types/models'

import * as reviewApi from './api'
import { currentClientId } from './client-id'

type Options = {
  busy: boolean
  revealing: boolean
  undoToken: string
  statsUndoToken: string
  mounted: MutableRefObject<boolean>
  setBusy: Dispatch<SetStateAction<boolean>>
  setUndoToken: Dispatch<SetStateAction<string>>
  setCounts: Dispatch<SetStateAction<ReviewCounts>>
  setDueTotal: Dispatch<SetStateAction<number>>
  setToast: Dispatch<SetStateAction<string>>
  applyProgress: (progress?: ReviewProgress) => void
  loadNext: (retried?: boolean) => Promise<void>
  loadStats: (force?: boolean) => Promise<void>
  ratedIds: MutableRefObject<Set<number>>
  ratedOrder: MutableRefObject<{ id: number; counted: boolean }[]>
  setReviewed: Dispatch<SetStateAction<number>>
  setRatedThisTab: Dispatch<SetStateAction<number>>
}

export function useReviewUndo(options: Options) {
  const {
    busy,
    revealing,
    undoToken,
    statsUndoToken,
    mounted,
    setBusy,
    setUndoToken,
    setCounts,
    setDueTotal,
    setToast,
    applyProgress,
    loadNext,
    loadStats,
    ratedIds,
    ratedOrder,
    setReviewed,
    setRatedThisTab,
  } = options
  const queued = useRef(false)

  const undo = useCallback(async () => {
    const token = undoToken || statsUndoToken
    if (!token) {
      setToast('没有可撤销的评分：只能撤销本标签页最近 10 分钟内的评分')
      return
    }
    if (busy || revealing) {
      queued.current = true
      return
    }
    setBusy(true)
    try {
      const data = await reviewApi.undoAnswer({ token, clientId: currentClientId() })
      if (!mounted.current) return
      setUndoToken('')
      const last = ratedOrder.current.pop()
      if (last) {
        if (last.counted) {
          ratedIds.current.delete(last.id)
          setReviewed((value) => Math.max(0, value - 1))
        }
        setRatedThisTab((value) => Math.max(0, value - 1))
      }
      setCounts(data.counts)
      setDueTotal(data.dueTotal)
      applyProgress(data.progress)
      setToast(last ? '已撤销上一张' : '已撤销最近一次评分')
      await loadNext(true)
      void loadStats(true)
    } catch (err) {
      if (mounted.current) {
        setToast(errorMessage(err))
        if (err instanceof ApiError && err.code === 'undo_expired') setUndoToken('')
      }
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [
    busy,
    revealing,
    undoToken,
    statsUndoToken,
    mounted,
    setBusy,
    setUndoToken,
    setCounts,
    setDueTotal,
    setToast,
    applyProgress,
    loadNext,
    loadStats,
    ratedIds,
    ratedOrder,
    setReviewed,
    setRatedThisTab,
  ])

  useEffect(() => {
    if (busy || revealing || !queued.current) return
    queued.current = false
    void undo()
  }, [busy, revealing, undo])

  return undo
}
