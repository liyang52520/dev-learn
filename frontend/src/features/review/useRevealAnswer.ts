import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, errorMessage } from '@/shared/api/client'
import type { ReviewCard } from '@/types/models'

import * as reviewApi from './api'
import type { Phase } from './types'

type Options = {
  card: ReviewCard | null
  phase: Phase
  mounted: { current: boolean }
  loadNext: (retried?: boolean) => Promise<void>
  setAnswerHtml: (html: string) => void
  setPhase: (phase: Phase) => void
  setToast: (text: string) => void
}

/** 显示答案：先给卡片续期，长思考也不会在评分前被判过期。 */
export function useRevealAnswer(options: Options) {
  const { card, phase, mounted, loadNext, setAnswerHtml, setPhase, setToast } = options
  const [revealing, setRevealing] = useState(false)
  // 每次换卡或发起新请求都自增；旧请求回来时直接丢弃，避免把上一张的答案贴到下一张。
  const requestId = useRef(0)

  useEffect(() => {
    requestId.current += 1
    setRevealing(false)
  }, [card?.cardId])

  const reveal = useCallback(async () => {
    if (phase !== 'question' || revealing || !card) return
    if (!card.question?.hasAnswer) {
      setPhase('answer')
      return
    }
    const current = ++requestId.current
    const cardId = card.cardId
    const stale = () => !mounted.current || requestId.current !== current
    setRevealing(true)
    try {
      const touchError = await reviewApi
        .touchCard({ cardId })
        .catch((err: unknown) => err)
      if (stale()) return
      if (touchError instanceof ApiError && touchError.status === 409) {
        setToast('这张卡已过期，正在重新取卡')
        void loadNext(true)
        return
      }
      const data = await reviewApi.fetchCardAnswer(card.qid)
      if (stale()) return
      setAnswerHtml(data.answerHtml)
      setPhase('answer')
    } catch (err) {
      if (!stale()) setToast(errorMessage(err))
    } finally {
      if (!stale()) setRevealing(false)
    }
  }, [card, phase, revealing, mounted, loadNext, setAnswerHtml, setPhase, setToast])

  return { reveal, revealing }
}
