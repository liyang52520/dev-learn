import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, errorMessage } from '@/shared/api/client'
import type { ReviewCard, ReviewCounts } from '@/types/models'

import * as reviewApi from './api'
import { currentClientId } from './client-id'
import { clearSession } from './session-store'
import type { Phase } from './types'
import { useCardAction } from './useCardAction'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useRevealAnswer } from './useRevealAnswer'
import { useReviewStats } from './useReviewStats'
import { useSessionClock } from './useSessionClock'

export function useReviewSession() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [card, setCard] = useState<ReviewCard | null>(null)
  const [answerHtml, setAnswerHtml] = useState('')
  const [counts, setCounts] = useState<ReviewCounts>({ new: 0, learning: 0, review: 0 })
  const [dueTotal, setDueTotal] = useState(0)
  const [error, setError] = useState('')
  const [errorStatus, setErrorStatus] = useState(0)
  const [errorCode, setErrorCode] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [stuck, setStuck] = useState(false)
  const [undoToken, setUndoToken] = useState('')

  const mounted = useRef(true)
  const undoQueued = useRef(false)
  const loadNextRef = useRef<(retried?: boolean) => Promise<void>>(async () => {})
  const { stats, loadStats, applyProgress } = useReviewStats()
  const {
    topics,
    setTopics,
    elapsedMs,
    setElapsedMs,
    setRatedThisTab,
    segmentRef,
    ratedIds,
    ratedOrder,
    flushSegment,
    reset,
  } = useSessionClock({ phase, reviewed, dayKey: stats?.todayKey, setReviewed })
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (phase !== 'loading') {
      setStuck(false)
      return
    }
    const timer = window.setTimeout(() => setStuck(true), 4000)
    return () => window.clearTimeout(timer)
  }, [phase])
  const finish = useCallback(() => {
    const spent = flushSegment()
    segmentRef.current = null
    setElapsedMs(spent)
    setCard(null)
    setAnswerHtml('')
    setPhase('done')
    clearSession()
    void loadStats(true)
  }, [flushSegment, loadStats, segmentRef, setElapsedMs])
  const loadNext = useCallback(
    async (retried = false) => {
      setBusy(true)
      try {
        const data = await reviewApi.fetchQueue()
        if (!mounted.current) return
        setCounts(data.counts)
        setDueTotal(data.dueTotal)
        if (!data.cards.length) {
          finish()
          return
        }
        if (segmentRef.current === null) segmentRef.current = Date.now()
        setAnswerHtml('')
        setCard(data.cards[0])
        setPhase('question')
      } catch (err) {
        if (!mounted.current) return
        if (err instanceof ApiError && err.status === 409 && !retried) {
          setToast('这张卡的状态已更新，正在重新取卡')
          window.setTimeout(() => void loadNextRef.current(true), 250)
          return
        }
        setErrorStatus(err instanceof ApiError ? err.status : 0)
        setErrorCode(err instanceof ApiError ? err.code : '')
        setError(errorMessage(err))
        setPhase('error')
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [finish, segmentRef],
  )

  useEffect(() => { loadNextRef.current = loadNext }, [loadNext])

  useEffect(() => {
    mounted.current = true
    void loadNext()
    void loadStats(true)
    return () => { mounted.current = false }
  }, [loadNext, loadStats])

  const { reveal, revealing } = useRevealAnswer({
    card,
    phase,
    mounted,
    loadNext,
    setAnswerHtml,
    setPhase,
    setToast,
  })

  const rate = useCallback(
    async (rating: number) => {
      if (!card || busy) return
      setBusy(true)
      try {
        const data = await reviewApi.submitAnswer({
          cardId: card.cardId,
          rating,
          clientId: currentClientId(),
        })
        if (!mounted.current) return
        const counted = !ratedIds.current.has(card.cardId)
        if (counted) {
          ratedIds.current.add(card.cardId)
          setReviewed((value) => value + 1)
        }
        ratedOrder.current.push({ id: card.cardId, counted })
        setRatedThisTab((value) => value + 1)
        const topic = card.question?.topic
        if (topic) setTopics((previous) => (previous.includes(topic) ? previous : [...previous, topic]))
        flushSegment()
        setCounts(data.counts)
        setDueTotal(data.dueTotal)
        setUndoToken(data.undoToken)
        applyProgress(data.progress)
        setAnswerHtml('')
        if (!data.next) {
          finish()
        } else {
          setCard(data.next)
          setPhase('question')
        }
        void loadStats()
      } catch (err) {
        if (!mounted.current) return
        if (err instanceof ApiError && err.status === 409) {
          setToast(
            err.code === 'stale_card'
              ? '思考超过 30 分钟，这张卡已重新排队，正在重新取卡'
              : '这张卡已被其他标签页处理，正在取下一张',
          )
          void loadNext(true)
          return
        }
        setErrorStatus(err instanceof ApiError ? err.status : 0)
        setErrorCode(err instanceof ApiError ? err.code : '')
        setError(errorMessage(err))
        setPhase('error')
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [card, busy, applyProgress, finish, flushSegment, loadNext, loadStats, ratedIds, ratedOrder, setRatedThisTab, setTopics],
  )

  const undo = useCallback(async () => {
    const token = undoToken || stats?.undoToken || ''
    if (!token) {
      setToast('没有可撤销的评分')
      return
    }
    if (busy) {
      undoQueued.current = true
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
  }, [busy, undoToken, stats, applyProgress, loadNext, loadStats, ratedIds, ratedOrder, setRatedThisTab])

  const cardAction = useCardAction({
    card,
    busy,
    mounted,
    setBusy,
    setCard,
    setPhase,
    setCounts,
    setDueTotal,
    setAnswerHtml,
    setToast,
    applyProgress,
    finish,
    loadNext,
    loadStats,
  })

  useEffect(() => {
    if (busy || !undoQueued.current) return
    undoQueued.current = false
    void undo()
  }, [busy, undo])

  const endSession = useCallback(() => {
    // 评分请求在途时结束，响应回来后会把页面重新拉回题面。
    if (busy) return
    finish()
  }, [busy, finish])

  const continueRound = useCallback(() => {
    const hasRemaining = counts.new + counts.learning + counts.review > 0
    // 没有剩余卡时的「看看有没有新卡」不能清空本轮小结。
    if (hasRemaining) reset()
    setPhase('loading')
    setCard(null)
    void loadNext(false)
  }, [counts, loadNext, reset])

  const retry = useCallback(() => {
    setError('')
    setErrorCode('')
    setPhase('loading')
    void loadNext()
  }, [loadNext])
  useKeyboardShortcuts({
    phase,
    busy,
    reviewed,
    canUndo: Boolean(undoToken || stats?.undoToken),
    reveal: () => void reveal(),
    rate: (rating) => void rate(rating),
    undo: () => void undo(),
    cardAction: (action) => void cardAction(action),
    endSession,
  })
  const canUndo = Boolean(undoToken || stats?.undoToken)
  return {
    phase,
    card,
    answerHtml,
    counts,
    dueTotal,
    stats,
    error,
    errorStatus,
    errorCode,
    toast,
    busy,
    reviewed,
    elapsedMs,
    topics,
    stuck,
    revealing,
    canUndo,
    reveal,
    rate,
    undo,
    cardAction,
    endSession,
    continueRound,
    retry,
  }
}
