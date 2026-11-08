import { useCallback, useState } from 'react'

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

  const reveal = useCallback(async () => {
    if (phase !== 'question' || revealing || !card) return
    if (!card.question?.hasAnswer) {
      setPhase('answer')
      return
    }
    setRevealing(true)
    try {
      const touchError = await reviewApi
        .touchCard({ cardId: card.cardId })
        .catch((err: unknown) => err)
      if (touchError instanceof ApiError && touchError.status === 409) {
        setToast('这张卡已过期，正在重新取卡')
        void loadNext(true)
        return
      }
      const data = await reviewApi.fetchCardAnswer(card.qid)
      if (!mounted.current) return
      setAnswerHtml(data.answerHtml)
      setPhase('answer')
    } catch (err) {
      if (mounted.current) setToast(errorMessage(err))
    } finally {
      if (mounted.current) setRevealing(false)
    }
  }, [card, phase, revealing, mounted, loadNext, setAnswerHtml, setPhase, setToast])

  return { reveal, revealing }
}
