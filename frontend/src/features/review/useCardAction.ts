import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import { ApiError, errorMessage } from '@/shared/api/client'
import type { ReviewCard, ReviewCounts, ReviewProgress } from '@/types/models'

import * as reviewApi from './api'
import { currentClientId } from './client-id'
import type { CardAction, Phase } from './types'

type Options = {
  card: ReviewCard | null
  busy: boolean
  mounted: MutableRefObject<boolean>
  setBusy: Dispatch<SetStateAction<boolean>>
  setCard: Dispatch<SetStateAction<ReviewCard | null>>
  setPhase: Dispatch<SetStateAction<Phase>>
  setCounts: Dispatch<SetStateAction<ReviewCounts>>
  setDueTotal: Dispatch<SetStateAction<number>>
  setAnswerHtml: Dispatch<SetStateAction<string>>
  setToast: Dispatch<SetStateAction<string>>
  setUndoToken: Dispatch<SetStateAction<string>>
  applyProgress: (progress?: ReviewProgress) => void
  finish: () => void
  loadNext: (retried?: boolean) => Promise<void>
  loadStats: (force?: boolean) => Promise<void>
}

/** 埋藏 / 暂停 / 标记：操作完直接拿下一张，不经过评分。 */
export function useCardAction(options: Options) {
  const {
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
    setUndoToken,
    applyProgress,
    finish,
    loadNext,
    loadStats,
  } = options

  return useCallback(
    async (action: CardAction) => {
      if (!card || busy) return
      setBusy(true)
      try {
        const flag = action === 'flag' ? (card.flag ? 0 : 1) : undefined
        const data = await reviewApi.submitCardAction({
          cardId: card.cardId,
          action,
          flag,
          clientId: currentClientId(),
        })
        if (!mounted.current) return
        setCounts(data.counts)
        setDueTotal(data.dueTotal)
        // 埋藏/暂停/标记都会写 collection，后端已作废旧评分凭证。
        setUndoToken('')
        applyProgress(data.progress)
        if (action === 'flag') {
          // 标记不调度，留在当前卡上；显示中的答案不能因为按了 F 就消失。
          setCard({ ...card, flag: flag ?? 0 })
          setToast(flag ? '已标记' : '已取消标记')
          void loadStats()
          return
        }
        setAnswerHtml('')
        setToast(action === 'bury' ? '已埋藏，这张卡今天不再出现' : '已暂停这张卡，可在 Anki 里恢复')
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
          setToast('这张卡已变化，正在重新取卡')
          void loadNext(true)
          return
        }
        setToast(errorMessage(err))
      } finally {
        if (mounted.current) setBusy(false)
      }
    },
    [
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
      setUndoToken,
      applyProgress,
      finish,
      loadNext,
      loadStats,
    ],
  )
}
