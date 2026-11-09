import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { ReviewStats, StudyOverview } from '@/types/models'

import { fetchStudyOverview, fetchStudyStats } from '../api'
import { StudyForecastCard, StudyTodayCard, StudyTrendCard } from './StudyActivityCards'
import { StudyHeatmapCard } from './StudyHeatmapCard'
import { StudyMetricGrid, StudyProgressCard } from './StudyOverviewCards'
import { StudyTopicProgressList } from './StudyTopicProgress'

export function StudyStatsTab() {
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [overview, setOverview] = useState<StudyOverview | null>(null)
  const [error, setError] = useState('')
  const [overviewError, setOverviewError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    // 基础统计决定整页能否渲染；深度统计失败只降级部分卡片。
    const [statsResult, overviewResult] = await Promise.allSettled([
      fetchStudyStats(),
      fetchStudyOverview(),
    ])
    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value)
    } else {
      setStats(null)
      setError(errorMessage(statsResult.reason))
    }
    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value)
      setOverviewError('')
    } else {
      setOverview(null)
      setOverviewError(errorMessage(overviewResult.reason))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !stats) return <p className="muted">正在读取学习统计…</p>
  if (!stats) {
    return (
      <div className="study-admin-offline">
        <h2>复习服务不可用</h2>
        <p>{error || '没有读到学习状态。'}</p>
        <p className="study-admin-hint">
          先执行 <code>cd backend && python -m app.features.review.importer</code> 初始化复习数据，或执行
          <code>python backend/scripts/dev.py</code> 启动服务，再点下面的按钮重试。
        </p>
        <button type="button" className="admin-button primary" onClick={() => void load()}>
          重试
        </button>
      </div>
    )
  }

  return (
    <>
      <StudyMetricGrid stats={stats} overview={overview} />
      {overviewError && (
        <p className="study-admin-stats-error">
          深度统计暂时不可用：{overviewError}。基础指标仍可查看，点
          <button type="button" className="study-admin-retry" onClick={() => void load()}>
            重试
          </button>
          再试一次。
        </p>
      )}
      <div className="study-stats-columns">
        <StudyProgressCard stats={stats} overview={overview} />
        <StudyTodayCard stats={stats} />
      </div>
      <div className="study-stats-columns">
        <StudyTrendCard days={stats.days} todayKey={stats.todayKey} />
        <StudyForecastCard forecast={overview?.forecast ?? null} />
      </div>
      <StudyHeatmapCard stats={stats} />
      {overview && <StudyTopicProgressList topics={overview.topics} />}
    </>
  )
}
