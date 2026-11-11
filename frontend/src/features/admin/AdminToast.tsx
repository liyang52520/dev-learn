import { useEffect, useRef } from 'react'

export type AdminNotice = { tone: 'success' | 'error' | 'info'; text: string }

const ICONS: Record<AdminNotice['tone'], string> = {
  success: '✓',
  error: '!',
  info: 'i',
}

const DURATIONS: Record<AdminNotice['tone'], number> = {
  success: 4000,
  info: 4000,
  error: 8000,
}

type Props = {
  notice: AdminNotice | null
  onClose: () => void
}

/** 固定在页面顶部的小提示：操作结果不随页面滚动丢失，也不打断当前操作。 */
export function AdminToast({ notice, onClose }: Props) {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => closeRef.current(), DURATIONS[notice.tone])
    return () => window.clearTimeout(timer)
  }, [notice])

  if (!notice) return null

  return (
    <div
      className={`admin-toast is-${notice.tone}`}
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <span className="admin-toast-icon" aria-hidden="true">
        {ICONS[notice.tone]}
      </span>
      <span className="admin-toast-text">{notice.text}</span>
    </div>
  )
}
