import { Link } from 'react-router-dom'

import type { ReviewCounts } from '@/types/models'

type Props = {
  loaded: boolean
  counts: ReviewCounts
  backlog: number
  streak: number
  newDone: number | null
  newLimit: number | null
  revDone: number | null
  revLimit: number | null
  reviewed: number
  busy: boolean
  onEnd: () => void
}

export function ReviewTop(props: Props) {
  const { loaded, counts, backlog, streak, newDone, newLimit, revDone, revLimit, reviewed, busy } =
    props
  const newPct =
    newLimit !== null && newLimit > 0 && newDone !== null
      ? Math.min(100, Math.round((newDone / newLimit) * 100))
      : 0
  const revPct =
    revLimit !== null && revLimit > 0 && revDone !== null
      ? Math.min(100, Math.round((revDone / revLimit) * 100))
      : 0
  const remaining = counts.new + counts.learning + counts.review
  // aria-valuenow 不得超过 max；暂停时 max 至少为 1。
  const newMax = Math.max(newLimit ?? 0, 1)
  const revMax = Math.max(revLimit ?? 0, 1)

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
              aria-valuemax={newMax}
              aria-valuenow={Math.min(newDone ?? 0, newMax)}
              aria-label={
                newLimit === null
                  ? '今日新卡额度加载中'
                  : newLimit > 0
                    ? `今日新卡 ${newDone ?? 0} / ${newLimit}`
                    : '今日新卡已暂停'
              }
            >
              <span className="review-progress-fill" style={{ width: `${newPct}%` }} />
            </span>
            <span className="review-progress-label">
              今日新卡{' '}
              {newLimit === null ? (
                '—'
              ) : newLimit > 0 ? (
                <>
                  <strong>{newDone ?? '—'}</strong>/{newLimit}
                </>
              ) : (
                '已暂停'
              )}
            </span>
          </span>
          <span className="review-progress-item">
            <span
              className="review-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={revMax}
              aria-valuenow={Math.min(revDone ?? 0, revMax)}
              aria-label={
                revLimit === null
                  ? '今日复习额度加载中'
                  : revLimit > 0
                    ? `今日复习 ${revDone ?? 0} / ${revLimit}`
                    : '今日复习已暂停'
              }
            >
              <span className="review-progress-fill review-progress-fill-soft" style={{ width: `${revPct}%` }} />
            </span>
            <span className="review-progress-label">
              今日复习{' '}
              {revLimit === null ? (
                '—'
              ) : revLimit > 0 ? (
                <>
                  <strong>{revDone ?? '—'}</strong>/{revLimit}
                </>
              ) : (
                '已暂停'
              )}
            </span>
          </span>
        </div>
        <div className="review-chips">
          <span className="review-session">
            本轮已评 <strong>{reviewed}</strong> 张 · 队列剩余 <strong>{loaded ? remaining : '—'}</strong> 张
          </span>
          <span>新卡 <strong>{loaded ? counts.new : '—'}</strong></span>
          <span>学习中 <strong>{loaded ? counts.learning : '—'}</strong></span>
          <span>可复习 <strong>{loaded ? counts.review : '—'}</strong></span>
          <span title="已到期的学习中与复习卡，不含新卡">
            待复习总量 <strong>{loaded ? backlog : '—'}</strong>
          </span>
          <span>{streak > 0 ? <>连续 <strong>{streak}</strong> 天</> : '今天还没复习'}</span>
        </div>
      </div>
      <div className="review-top-actions">
        <Link to="/admin/study" className="review-settings" title="每日额度、暂停与学习统计">
          设置
        </Link>
        <button
          type="button"
          className="review-end"
          onClick={props.onEnd}
          disabled={busy}
          title={busy ? '正在处理这次评分，请稍候' : '不要求清空队列，随时可以结束看小结（Esc）'}
        >
          结束本轮
        </button>
      </div>
    </header>
  )
}
