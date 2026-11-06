import { Link } from 'react-router-dom'

import type { ReviewCounts, ReviewStats } from '@/types/models'

import { Heatmap } from './Heatmap'

type Props = {
  reviewed: number
  elapsedMs: number
  stats: ReviewStats | null
  counts: ReviewCounts
  dueTotal: number
  topics: string[]
  onContinue: () => void
}

export function ReviewDone({ reviewed, elapsedMs, stats, counts, dueTotal, topics, onContinue }: Props) {
  const seconds = Math.round(elapsedMs / 1000)
  const duration = seconds < 60 ? `${Math.max(1, seconds)} 秒` : `${Math.round(seconds / 60)} 分钟`
  const perCard = reviewed > 0 ? Math.max(1, Math.round(seconds / reviewed)) : 0
  const remaining = counts.new + counts.learning + counts.review
  const finishedAll = remaining === 0
  const newLimit = stats?.newPerDay ?? 0
  const revLimit = stats?.revPerDay ?? 0
  const overflow = Math.max(0, dueTotal - (counts.learning + counts.review))
  const hitNewLimit =
    newLimit > 0 && stats !== null && stats.todayNew >= newLimit && (stats?.newRemaining ?? 0) > 0
  const hitRevLimit = revLimit > 0 && stats !== null && stats.todayReview >= revLimit && overflow > 0
  const outOfQuota = hitNewLimit || hitRevLimit
  const nextDue = stats?.nextDueEpoch ? formatNextDue(stats.nextDueEpoch) : null
  const title =
    reviewed > 0
      ? finishedAll
        ? outOfQuota
          ? '今天的额度用完了'
          : '今天的复习完成了'
        : '这一轮结束了'
      : finishedAll
        ? outOfQuota
          ? '今天的额度用完了'
          : '现在没有到期的卡'
        : '还没有开始'

  return (
    <div className="review-panel review-done">
      <div className={`review-done-mark${finishedAll ? '' : ' is-paused'}`} aria-hidden>
        {finishedAll ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5 9.5 18 20 6.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
            <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
            <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
          </svg>
        )}
      </div>
      <p className="eyebrow">{finishedAll ? 'SESSION COMPLETE' : 'ROUND PAUSED'}</p>
      <h1>{title}</h1>
      <p className="review-done-sub">
        {reviewed > 0
          ? `用时 ${duration}${perCard > 0 ? `，平均每张 ${perCard} 秒` : ''}。`
          : finishedAll
            ? '下一批到期后，从学习首页点「开始复习」就行。'
            : '点下面的按钮继续，或者回到学习首页。'}
      </p>

      {reviewed > 0 && (
        <div className="review-done-count" aria-label={`本轮评过 ${reviewed} 张卡`}>
          <span className="review-done-count-label">本轮已评</span>
          <span className="review-done-count-num">
            <strong>{reviewed}</strong>
            <span>张</span>
          </span>
        </div>
      )}

      <div className="review-done-stats">
        <span><strong>{stats?.today ?? '—'}</strong>今日学过（张）</span>
        <span><strong>{stats?.streak ?? '—'}</strong>连续天数</span>
        <span><strong>{stats?.totalReviews ?? '—'}</strong>累计复习（次）</span>
      </div>

      {stats && (
        <p className="review-done-quota">
          今日 新卡 {stats.todayNew}/{stats.newPerDay} · 复习 {stats.todayReview}/{stats.revPerDay}
          {stats.todayRelearn > 0 ? ` · 重学 ${stats.todayRelearn}` : ''}
          {stats.newRemaining > 0 ? ` · 还有 ${stats.newRemaining} 张新卡没学` : ''}
        </p>
      )}

      {topics.length > 0 && (
        <p className="review-done-topics">
          覆盖 {topics.length} 个专题：{topics.slice(0, 5).join(' · ')}
          {topics.length > 5 ? ' 等' : ''}
        </p>
      )}

      {nextDue && finishedAll && (
        <p className="review-done-next">
          <span className="review-done-next-dot" aria-hidden />
          下次可学：{nextDue}
        </p>
      )}

      {stats && <Heatmap days={stats.days} />}

      <div className="review-done-actions">
        <button type="button" className="review-btn" onClick={onContinue}>
          {remaining > 0 ? `继续复习 · 还剩 ${remaining} 张` : '再检查一次'}
        </button>
        <Link to="/study" className="review-btn ghost">回到学习</Link>
      </div>

      {hitRevLimit && (
        <p className="review-done-help">
          今天复习额度已满，还有 {overflow} 张到期卡，明天继续（额度可在设置里调整）。
        </p>
      )}
      {hitNewLimit && !hitRevLimit && (
        <p className="review-done-help">
          新卡额度打满不代表都学会了，剩下的 {stats?.newRemaining} 张明天继续。
        </p>
      )}
    </div>
  )
}

function formatNextDue(epochSeconds: number): string {
  const due = new Date(epochSeconds * 1000)
  const now = new Date()
  if (due.getTime() < now.getTime() - 60_000) return '现在'
  const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((dayStart(due) - dayStart(now)) / 86_400_000)
  const hours = String(due.getHours()).padStart(2, '0')
  const minutes = String(due.getMinutes()).padStart(2, '0')
  if (days <= 0) return `今天 ${hours}:${minutes}`
  if (days === 1) return '明天'
  if (days === 2) return '后天'
  return `${due.getMonth() + 1} 月 ${due.getDate()} 日`
}
