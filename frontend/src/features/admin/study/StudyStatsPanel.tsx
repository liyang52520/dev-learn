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
          <span>累计复习（次）</span>
          <strong>{stats.totalReviews}</strong>
        </div>
        <div>
          <span>今日可学（队列）</span>
          <strong>{due}</strong>
        </div>
        <div>
          <span>到期总量</span>
          <strong>{stats.dueTotal}</strong>
        </div>
        <div>
          <span>未学新卡</span>
          <strong>{stats.newRemaining}</strong>
        </div>
      </section>

      {stats.days.length > 0 && (
        <section className="study-admin-card study-admin-heatmap">
          <div className="study-admin-heatmap-head">
            <h3>最近 26 周</h3>
            <span>
              今日 {stats.today} 次 · 连续 {stats.streak} 天 · 累计 {stats.totalReviews} 次
            </span>
          </div>
          <Heatmap days={stats.days} />
        </section>
      )}
    </>
  )
}
