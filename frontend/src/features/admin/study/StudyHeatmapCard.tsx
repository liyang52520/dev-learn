import type { ReviewStats } from '@/types/models'

import { Heatmap } from '@/features/review/components/Heatmap'

export function StudyHeatmapCard({ stats }: { stats: ReviewStats }) {
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
