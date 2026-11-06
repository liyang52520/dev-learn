import { useEffect } from 'react'

import type { Phase } from './types'

type Handlers = {
  phase: Phase
  busy: boolean
  reviewed: number
  reveal: () => void
  rate: (rating: number) => void
  undo: () => void
  endSession: () => void
}

/** 空格显示答案、1–4 评分、U 撤销、Esc 结束本轮。 */
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
        if (handlers.reviewed > 0) {
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
      if (
        (handlers.phase === 'question' || handlers.phase === 'answer') &&
        event.key.toLowerCase() === 'u'
      ) {
        event.preventDefault()
        handlers.undo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handlers])
}
