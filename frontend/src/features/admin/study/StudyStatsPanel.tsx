import type { ReviewStats } from '@/types/models'

import { Heatmap } from '@/features/review/components/Heatmap'

export function StudyStatsPanel({ stats }: { stats: ReviewStats }) {
  const due = stats.counts.new + stats.counts.learning + stats.counts.review
  return (
    <>
      <section className="admin-stats study-admin-stats">
        <div>
          <span>今日学过（张）</span>
          <strong>{stats.today}</strong>
        </div>
        <div>
          <span>连续天数</span>
          <strong>{stats.streak}</strong>
        </div>
        <div>
          <span>累计作答（次）</span>
          <strong>{stats.totalAnswers}</strong>
        </div>
        <div>
          <span>当前队列（张）</span>
          <strong>{due}</strong>
        </div>
        <div>
          <span>到期卡片（张）</span>
          <strong>{stats.dueTotal}</strong>
        </div>
        <div>
          <span>未学新卡（张）</span>
          <strong>{stats.newRemaining}</strong>
        </div>
      </section>
    </>
  )
}

export function StudyHeatmap({ stats }: { stats: ReviewStats }) {
  if (stats.days.length === 0) return null
  return (
    <section className="study-admin-card study-admin-heatmap">
      <div className="study-admin-heatmap-head">
        <h3>最近 26 周</h3>
        <span>
          今日 {stats.today} 张 · {stats.streak > 0 ? `连续 ${stats.streak} 天` : '今天还没复习'} · 累计作答{' '}
          {stats.totalAnswers} 次
        </span>
      </div>
      <Heatmap days={stats.days} todayKey={stats.todayKey} />
    </section>
  )
}
