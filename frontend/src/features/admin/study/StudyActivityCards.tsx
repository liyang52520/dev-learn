import { useMemo } from 'react'

import type { ReviewDay, ReviewStats, StudyForecastDay } from '@/types/models'

import { parseIso, toIso } from './study-format'

const TREND_DAYS = 30

export function StudyTodayCard({ stats }: { stats: ReviewStats }) {
  const due = stats.counts.new + stats.counts.learning + stats.counts.review
  return (
    <section className="study-admin-card">
      <div className="study-card-head">
        <h3>今天的节奏</h3>
        <span>额度按卡算，不按看卡次数算</span>
      </div>
      <QuotaRow label="新学" value={stats.todayNew} limit={stats.newPerDay} />
      <QuotaRow label="复习" value={stats.todayReview} limit={stats.revPerDay} />
      <div className="study-quota-row">
        <span className="study-quota-label">重学</span>
        <strong>{stats.todayRelearn}</strong>
        <span className="study-quota-note">不占额度</span>
      </div>
      <p className="study-admin-hint study-today-note">
        今日需学 {due} 张 · 明日到期 {stats.dueTomorrow} 张 · 全库还有 {stats.newRemaining} 张新卡没学
      </p>
    </section>
  )
}

function QuotaRow({ label, value, limit }: { label: string; value: number; limit: number }) {
  const paused = limit <= 0
  const percent = paused ? 0 : Math.min(100, (value / limit) * 100)
  return (
    <div className="study-quota-row">
      <span className="study-quota-label">{label}</span>
      <span className="study-quota-value">
        <strong>{value}</strong>
        <span>/{paused ? '已暂停' : limit}</span>
      </span>
      <span className="study-quota-track" aria-hidden>
        <span style={{ width: `${percent}%` }} />
      </span>
    </div>
  )
}

export function StudyTrendCard({ days, todayKey }: { days: ReviewDay[]; todayKey: string }) {
  const cells = useMemo(() => {
    const byDate = new Map(days.map((day) => [day.date, day.count]))
    const end = parseIso(todayKey)
    return Array.from({ length: TREND_DAYS }, (_, index) => {
      const date = new Date(end)
      date.setDate(end.getDate() - (TREND_DAYS - 1 - index))
      const key = toIso(date)
      return { key, count: byDate.get(key) || 0 }
    })
  }, [days, todayKey])

  const total = cells.reduce((sum, cell) => sum + cell.count, 0)
  const peak = cells.reduce((max, cell) => Math.max(max, cell.count), 0)
  const active = cells.filter((cell) => cell.count > 0).length
  const last7 = cells.slice(-7).reduce((sum, cell) => sum + cell.count, 0)
  const max = Math.max(peak, 1)

  return (
    <section className="study-admin-card">
      <div className="study-card-head">
        <h3>近 30 天节奏</h3>
        <span>按卡去重</span>
      </div>
      <div className="study-bar-chart" aria-label={`近 30 天共学习 ${total} 张，单日最高 ${peak} 张`}>
        {cells.map((cell) => (
          <span
            key={cell.key}
            className={cell.count > 0 ? 'study-bar' : 'study-bar is-empty'}
            style={{ height: `${Math.max(4, (cell.count / max) * 100)}%` }}
            title={`${cell.key} · ${cell.count} 张`}
          />
        ))}
      </div>
      <dl className="study-chart-summary">
        <div>
          <dt>30 天合计</dt>
          <dd>{total} 张</dd>
        </div>
        <div>
          <dt>近 7 天</dt>
          <dd>{last7} 张</dd>
        </div>
        <div>
          <dt>活跃</dt>
          <dd>{active} 天</dd>
        </div>
        <div>
          <dt>单日最高</dt>
          <dd>{peak} 张</dd>
        </div>
      </dl>
    </section>
  )
}

export function StudyForecastCard({ forecast }: { forecast: StudyForecastDay[] | null }) {
  if (!forecast || forecast.length === 0) {
    return (
      <section className="study-admin-card">
        <div className="study-card-head">
          <h3>未来到期</h3>
        </div>
        <p className="study-admin-hint">深度统计暂时不可用，稍后刷新再看。</p>
      </section>
    )
  }
  const peak = Math.max(...forecast.map((day) => day.count))
  const max = Math.max(peak, 1)
  const total = forecast.reduce((sum, day) => sum + day.count, 0)
  return (
    <section className="study-admin-card">
      <div className="study-card-head">
        <h3>未来 14 天到期</h3>
        <span>含今天已逾期</span>
      </div>
      <div className="study-bar-chart is-forecast" aria-label={`未来 14 天共 ${total} 张卡到期`}>
        {forecast.map((day, index) => (
          <span
            key={day.date}
            className={index === 0 ? 'study-bar is-today' : day.count > 0 ? 'study-bar' : 'study-bar is-empty'}
            style={{ height: `${Math.max(4, (day.count / max) * 100)}%` }}
            title={`${index === 0 ? '今天' : day.date.slice(5)} · ${day.count} 张`}
          />
        ))}
      </div>
      <dl className="study-chart-summary">
        <div>
          <dt>合计</dt>
          <dd>{total} 张</dd>
        </div>
        <div>
          <dt>截至明日</dt>
          <dd>{forecast[0].count + (forecast[1]?.count ?? 0)} 张</dd>
        </div>
        <div>
          <dt>一周内</dt>
          <dd>{forecast.slice(0, 7).reduce((sum, day) => sum + day.count, 0)} 张</dd>
        </div>
        <div>
          <dt>单日最高</dt>
          <dd>{peak} 张</dd>
        </div>
      </dl>
    </section>
  )
}
