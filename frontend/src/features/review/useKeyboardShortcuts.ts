import { useEffect } from 'react'

import type { CardAction, Phase } from './types'

type Handlers = {
  phase: Phase
  busy: boolean
  reviewed: number
  canUndo: boolean
  reveal: () => void
  rate: (rating: number) => void
  undo: () => void
  cardAction: (action: CardAction) => void
  endSession: () => void
}

/** 空格显示答案、1–4 评分、U 撤销、B 埋藏、S 暂停、F 标记、Esc 结束本轮。 */
export function useKeyboardShortcuts(handlers: Handlers): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const interactive = Boolean(
        target && typeof target.closest === 'function' && target.closest('a, button, [role="button"]'),
      )
      if (event.key === 'Escape') {
        if (!handlers.busy && (handlers.phase === 'question' || handlers.phase === 'answer')) {
          event.preventDefault()
          handlers.endSession()
        }
        return
      }
      if ((event.key === ' ' || event.key === 'Enter') && !interactive && handlers.phase === 'question') {
        event.preventDefault()
        handlers.reveal()
        return
      }
      if (handlers.busy && event.key.toLowerCase() !== 'u') return
      if (handlers.phase === 'answer' && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault()
        handlers.rate(Number(event.key))
        return
      }
      const action = { b: 'bury', s: 'suspend', f: 'flag' }[event.key.toLowerCase()] as
        | CardAction
        | undefined
      if (action && (handlers.phase === 'question' || handlers.phase === 'answer')) {
        event.preventDefault()
        handlers.cardAction(action)
        return
      }
      if (
        (handlers.phase === 'question' || handlers.phase === 'answer') &&
        event.key.toLowerCase() === 'u'
      ) {
        if (!handlers.canUndo) return
        event.preventDefault()
        handlers.undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
