import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { ReviewConfig, ReviewStats } from '@/types/models'

import { fetchStudyConfig, fetchStudyStats } from '../api'
import { LimitsForm } from './LimitsForm'
import { StudyHeatmap, StudyStatsPanel } from './StudyStatsPanel'

export function StudySettings() {
  const [config, setConfig] = useState<ReviewConfig | null>(null)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [error, setError] = useState('')
  const [statsError, setStatsError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    // 统计失败不应该连带隐藏设置表单：两者独立降级。
    const [configResult, statsResult] = await Promise.allSettled([
      fetchStudyConfig(),
      fetchStudyStats(),
    ])
    if (configResult.status === 'fulfilled') {
      setConfig(configResult.value)
    } else {
      setConfig(null)
      setError(errorMessage(configResult.reason))
    }
    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value)
      setStatsError('')
    } else {
      setStats(null)
      setStatsError(errorMessage(statsResult.reason))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 首次加载才显示占位；保存后的静默刷新不应卸载表单，否则保存提示会瞬间消失。
  if (loading && !config) return <p className="muted">正在读取学习状态…</p>
  if (!config) {
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
      {stats ? (
        <StudyStatsPanel stats={stats} />
      ) : (
        <p className="study-admin-stats-error">
          统计暂时不可用：{statsError || '请稍后重试'}。每日上限仍可修改，保存后同样生效。
        </p>
      )}
      <div className="study-admin-grid">
        <div className="study-admin-section">
          <LimitsForm config={config} stats={stats} onSaved={() => void load()} />
        </div>
        {stats && <StudyHeatmap stats={stats} />}
      </div>
    </>
  )
}
