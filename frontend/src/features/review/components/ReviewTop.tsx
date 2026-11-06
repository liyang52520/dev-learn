import { Link } from 'react-router-dom'

import type { ReviewCounts } from '@/types/models'

type Props = {
  loaded: boolean
  counts: ReviewCounts
  backlog: number
  streak: number
  newDone: number | null
  newLimit: number
  revDone: number | null
  revLimit: number
  reviewed: number
  onEnd: () => void
}

export function ReviewTop(props: Props) {
  const { loaded, counts, backlog, streak, newDone, newLimit, revDone, revLimit, reviewed } = props
  const newPct = newLimit > 0 && newDone !== null ? Math.min(100, Math.round((newDone / newLimit) * 100)) : 0
  const revPct = revLimit > 0 && revDone !== null ? Math.min(100, Math.round((revDone / revLimit) * 100)) : 0

  return (
    <header className="review-top">
      <Link to="/study" className="review-back" aria-label="返回学习">
        ←
      </Link>
      <div className="review-head">
        <div className="review-progress">
          <span className="review-progress-item">
            <span
              className="review-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={newLimit || 0}
              aria-valuenow={newDone ?? 0}
              aria-label={`今日新卡 ${newDone ?? 0} / ${newLimit}`}
            >
              <span className="review-progress-fill" style={{ width: `${newPct}%` }} />
            </span>
            <span className="review-progress-label">
              今日新卡 <strong>{newDone ?? '—'}</strong>/{newLimit || '—'}
            </span>
          </span>
          <span className="review-progress-item">
            <span
              className="review-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={revLimit || 0}
              aria-valuenow={revDone ?? 0}
              aria-label={`今日复习 ${revDone ?? 0} / ${revLimit}`}
            >
              <span className="review-progress-fill review-progress-fill-soft" style={{ width: `${revPct}%` }} />
            </span>
            <span className="review-progress-label">
              今日复习 <strong>{revDone ?? '—'}</strong>/{revLimit || '—'}
            </span>
          </span>
        </div>
        <div className="review-chips">
          <span>待发新卡 <strong>{loaded ? counts.new : '—'}</strong></span>
          <span>学习中 <strong>{loaded ? counts.learning : '—'}</strong></span>
          <span>限额内复习 <strong>{loaded ? counts.review : '—'}</strong></span>
          <span>到期总量 <strong>{loaded ? backlog : '—'}</strong></span>
          <span>连续 <strong>{streak || '—'}</strong> 天</span>
        </div>
      </div>
      <button
        type="button"
        className="review-end"
        onClick={props.onEnd}
        disabled={reviewed === 0}
        title="不要求清空队列，随时可以结束看小结（Esc）"
      >
        结束本轮
      </button>
    </header>
  )
}
