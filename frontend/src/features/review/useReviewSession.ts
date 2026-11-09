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
import { useReviewUndo } from './useReviewUndo'
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
          await new Promise((resolve) => window.setTimeout(resolve, 250))
          await loadNextRef.current(true)
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
      if (!card || busy || revealing) return
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
          await loadNext(true)
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
    [card, busy, revealing, applyProgress, finish, flushSegment, loadNext, loadStats, ratedIds, ratedOrder, setRatedThisTab, setTopics],
  )

  const cardAction = useCardAction({
    card,
    busy: busy || revealing,
    mounted,
    setBusy,
    setCard,
    setPhase,
    setCounts,
    setDueTotal,
    setAnswerHtml,
    setToast,
    setUndoToken,
    applyProgress,
    finish,
    loadNext,
    loadStats,
  })

  const undo = useReviewUndo({
    busy,
    revealing,
    undoToken,
    statsUndoToken: stats?.undoToken ?? '',
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
  })

  const endSession = useCallback(() => {
    // 评分/显示答案在途时结束，响应回来后会把页面重新拉回题面。
    if (busy || revealing) return
    const remaining = counts.new + counts.learning + counts.review
    if (reviewed > 0 && remaining > 0) {
      const ok = window.confirm(`本轮已评 ${reviewed} 张，队列还剩 ${remaining} 张，确定结束吗？`)
      if (!ok) return
    }
    finish()
  }, [busy, revealing, counts, reviewed, finish])

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
    busy: busy || revealing,
    reviewed,
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
    busy: busy || revealing,
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
