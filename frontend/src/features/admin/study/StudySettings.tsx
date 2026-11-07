import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { ReviewConfig, ReviewStats } from '@/types/models'

import { fetchStudyConfig, fetchStudyStats } from '../api'
import { LimitsForm } from './LimitsForm'
import { StudyStatsPanel } from './StudyStatsPanel'

export function StudySettings() {
  const [config, setConfig] = useState<ReviewConfig | null>(null)
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextConfig, nextStats] = await Promise.all([fetchStudyConfig(), fetchStudyStats()])
      setConfig(nextConfig)
      setStats(nextStats)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // 首次加载才显示占位；保存后的静默刷新不应卸载表单，否则保存提示会瞬间消失。
  if (loading && !config) return <p className="muted">正在读取学习状态…</p>
  if (error || !config || !stats) {
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
      <StudyStatsPanel stats={stats} />
      <div className="study-admin-section">
        <LimitsForm config={config} stats={stats} onSaved={() => void load()} />
      </div>
    </>
  )
}
