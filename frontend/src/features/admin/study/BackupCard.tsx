import { useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { ReviewStats, SyncResult } from '@/types/models'

import { syncStudy } from '../api'

export function BackupCard({ stats }: { stats: ReviewStats }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [failure, setFailure] = useState('')

  const run = async () => {
    setBusy(true)
    setFailure('')
    try {
      setResult(await syncStudy())
    } catch (error) {
      setFailure(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const backup = stats.lastBackup
  return (
    <div className="study-admin-card">
      <h3>快照与同步</h3>
      <p className="study-admin-hint">
        服务每 10 分钟对 collection 做一次一致性快照，保留最近 30 份；有改动时每 15 分钟自动提交并推送到 dev-anki。
        这里可以立即执行一次。
      </p>
      <p className="study-admin-hint">
        {backup
          ? `最近快照：${backup.name} · ${formatSize(backup.size)} · ${formatTime(backup.at)}（共 ${backup.count} 份）`
          : '还没有本地快照；服务完成第一次自动备份后会显示在这里。'}
      </p>
      <button type="button" className="admin-button" disabled={busy} onClick={() => void run()}>
        {busy ? '正在快照并推送…' : '立即快照并推送'}
      </button>
      {result && (
        <p className={`study-admin-notice${result.status === 'ok' ? '' : ' is-warn'}`}>{result.message}</p>
      )}
      {failure && <p className="study-admin-notice is-warn">{failure}</p>}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.floor(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatTime(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
