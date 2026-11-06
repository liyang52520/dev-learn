import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, errorMessage } from '@/shared/api/client'
import type { ReviewCard, ReviewCounts } from '@/types/models'

import * as reviewApi from './api'
import { clearSession } from './session-store'
import type { Phase } from './types'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useReviewStats } from './useReviewStats'
import { useSessionClock } from './useSessionClock'

const EMPTY_COUNTS: ReviewCounts = { new: 0, learning: 0, review: 0 }

export function useReviewSession() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [card, setCard] = useState<ReviewCard | null>(null)
  const [answerHtml, setAnswerHtml] = useState('')
  const [counts, setCounts] = useState<ReviewCounts>(EMPTY_COUNTS)
  const [dueTotal, setDueTotal] = useState(0)
  const [error, setError] = useState('')
  const [errorStatus, setErrorStatus] = useState(0)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [stuck, setStuck] = useState(false)
  const [revealing, setRevealing] = useState(false)

  const mounted = useRef(true)
  const undoQueued = useRef(false)
  const loadNextRef = useRef<(retried?: boolean) => Promise<void>>(async () => {})
  const { stats, loadStats, applyProgress } = useReviewStats()
  const {
    topics,
    setTopics,
    elapsedMs,
    setElapsedMs,
    ratedThisTab,
    setRatedThisTab,
    segmentRef,
    ratedIds,
    ratedOrder,
    flushSegment,
    reset,
  } = useSessionClock({ phase, reviewed, setReviewed })

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
        setError(errorMessage(err))
        setPhase('error')
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [finish, segmentRef],
  )

  useEffect(() => {
    loadNextRef.current = loadNext
  }, [loadNext])

  useEffect(() => {
    mounted.current = true
    void loadNext()
    void loadStats(true)
    return () => {
      mounted.current = false
    }
  }, [loadNext, loadStats])

  const reveal = useCallback(async () => {
    if (phase !== 'question' || revealing || !card) return
    if (!card.question?.hasAnswer) {
      setPhase('answer')
      return
    }
    setRevealing(true)
    try {
      const data = await reviewApi.fetchCardAnswer(card.qid)
      if (!mounted.current) return
      setAnswerHtml(data.answerHtml)
      setPhase('answer')
    } catch (err) {
      if (mounted.current) setToast(errorMessage(err))
    } finally {
      if (mounted.current) setRevealing(false)
    }
  }, [phase, revealing, card])

  const rate = useCallback(
    async (rating: number) => {
      if (!card || busy) return
      setBusy(true)
      try {
        const data = await reviewApi.submitAnswer({ cardId: card.cardId, rating })
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
          setToast('这张卡已被处理，正在取下一张')
          void loadNext(true)
          return
        }
        setErrorStatus(err instanceof ApiError ? err.status : 0)
        setError(errorMessage(err))
        setPhase('error')
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [card, busy, applyProgress, finish, flushSegment, loadNext, loadStats, ratedIds, ratedOrder, setRatedThisTab, setTopics],
  )

  const undo = useCallback(async () => {
    if (busy) {
      undoQueued.current = true
      return
    }
    setBusy(true)
    try {
      const data = await reviewApi.undoAnswer()
      if (!mounted.current) return
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
      setToast(last ? '已撤销上一张' : '已撤销最近一次评分（来自其他标签页）')
      await loadNext(true)
      void loadStats(true)
    } catch (err) {
      if (mounted.current) setToast(errorMessage(err))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }, [busy, applyProgress, loadNext, loadStats, ratedIds, ratedOrder, setRatedThisTab])

  useEffect(() => {
    if (busy || !undoQueued.current) return
    undoQueued.current = false
    void undo()
  }, [busy, undo])

  const endSession = useCallback(() => finish(), [finish])

  const continueRound = useCallback(() => {
    reset()
    setPhase('loading')
    setCard(null)
    void loadNext(false)
  }, [loadNext, reset])

  const retry = useCallback(() => {
    setError('')
    setPhase('loading')
    void loadNext()
  }, [loadNext])

  useKeyboardShortcuts({
    phase,
    busy,
    reviewed,
    reveal: () => void reveal(),
    rate: (rating) => void rate(rating),
    undo: () => void undo(),
    endSession,
  })

  const canUndo = ratedThisTab > 0 || Boolean(stats?.canUndo)

  return {
    phase,
    card,
    answerHtml,
    counts,
    dueTotal,
    stats,
    error,
    errorStatus,
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
    endSession,
    continueRound,
    retry,
  }
}
