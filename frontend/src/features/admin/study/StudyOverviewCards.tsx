import type { ReviewStats, StudyOverview } from '@/types/models'

import { formatDuration } from './study-format'

type Props = {
  stats: ReviewStats
  overview: StudyOverview | null
}

/** 顶部指标：左边六项来自轻量 stats，右边两项来自深度 overview。 */
export function StudyMetricGrid({ stats, overview }: Props) {
  const due = stats.counts.new + stats.counts.learning + stats.counts.review
  const items = [
    {
      label: '今日已学（张）',
      value: String(stats.today),
      hint: '今天复习过的不同卡片数，同一张卡当天重复出现只算一次',
    },
    {
      label: '连续学习（天）',
      value: String(stats.streak),
      hint: '按凌晨 4 点换日计算；今天还没学则从上一天往前数',
    },
    {
      label: '累计作答（次）',
      value: String(stats.totalAnswers),
      hint: '所有评分记录，包含重学；同一张卡可以贡献多次',
    },
    {
      label: '累计时长',
      value: overview ? formatDuration(overview.totalTimeMs) : '—',
      hint: '按每次评分时记录的停留时间累加',
    },
    {
      label: '活跃天数',
      value: overview ? String(overview.activeDays) : '—',
      hint: '最近 400 天里有复习记录的天数',
    },
    {
      label: '到期卡片（张）',
      value: String(stats.dueTotal),
      hint: '真正到期、未被每日限额截断的卡（含学习中，不含新卡）',
    },
    {
      label: '未学新卡（张）',
      value: String(stats.newRemaining),
      hint: '全库尚未学过的新卡',
    },
    {
      label: '今日需学（张）',
      value: String(due),
      hint: '按今天的剩余额度实时计算，等于现在进入复习会发给你的卡数',
    },
    {
      label: '明日到期（张）',
      value: String(stats.dueTomorrow),
      hint: '到明天结束前会到期的卡，包含今天没清掉的逾期卡',
    },
  ]

  return (
    <section className="admin-stats study-admin-stats">
      {items.map((item) => (
        <div key={item.label}>
          <span title={item.hint}>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  )
}

/** 总进度与卡片成熟度：一眼看出「学了多少」和「记住多少」。 */
export function StudyProgressCard({ stats, overview }: Props) {
  const percent = stats.totalCards > 0 ? (stats.learnedCards / stats.totalCards) * 100 : 0
  const label = percent > 0 && percent < 1 ? '<1%' : `${Math.round(percent)}%`
  const maturity = overview
    ? [
        { key: 'new', label: '新卡', count: overview.newCards },
        { key: 'learning', label: '学习中', count: overview.learningCards },
        { key: 'young', label: '年轻卡', count: overview.youngCards },
        { key: 'mature', label: '成熟卡', count: overview.matureCards },
      ]
    : []

  return (
    <section className="study-admin-card study-progress-card">
      <div className="study-card-head">
        <h3>学习进度</h3>
        <span className="study-progress-pct">{label}</span>
      </div>
      <p className="study-progress-line">
        <strong>{stats.learnedCards}</strong> / {stats.totalCards} 张卡已学过
      </p>
      <div
        className="study-progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.max(stats.totalCards, 1)}
        aria-valuenow={Math.min(stats.learnedCards, Math.max(stats.totalCards, 1))}
        aria-label={`总进度 ${stats.learnedCards} / ${stats.totalCards}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      {overview && (
        <>
          <div className="study-maturity" aria-label="卡片成熟度分布">
            {maturity.map((item) => (
              <span
                key={item.key}
                className={`study-maturity-seg is-${item.key}`}
                style={{
                  width: `${stats.totalCards > 0 ? (item.count / stats.totalCards) * 100 : 0}%`,
                }}
                title={`${item.label} ${item.count} 张`}
              />
            ))}
          </div>
          <ul className="study-maturity-legend">
            {maturity.map((item) => (
              <li key={item.key}>
                <i className={`is-${item.key}`} aria-hidden />
                {item.label}
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
          <p className="study-admin-hint study-maturity-note">
            年轻卡是复习间隔还不到 21 天的卡，成熟卡是间隔超过 21 天的卡；间隔越长，说明记得越牢。
          </p>
          <dl className="study-intervals">
            <div>
              <dt>平均间隔</dt>
              <dd>{overview.avgIntervalDays} 天</dd>
            </div>
            <div>
              <dt>最长间隔</dt>
              <dd>{overview.maxIntervalDays} 天</dd>
            </div>
            <div>
              <dt>历史最长连续</dt>
              <dd>{overview.longestStreak} 天</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  )
}
