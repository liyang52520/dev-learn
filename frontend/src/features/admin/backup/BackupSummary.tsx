import type { BackupStatus } from '@/types/models'

type Props = {
  data: BackupStatus
  busy: boolean
  onPush: () => void
}

function ownState(data: BackupStatus): string {
  if (!data.ownPushed) return '尚未推送到远端'
  if (data.ownAhead > 0) return `本地有 ${data.ownAhead} 个提交未推送`
  if (data.ownBehind > 0) return `远端本机分支多 ${data.ownBehind} 个提交`
  return '与远端一致'
}

function dirtyText(data: BackupStatus): string {
  if (data.dirty === null) return '无法读取'
  return data.dirty ? '有未提交改动' : '干净'
}

export function BackupSummary({ data, busy, onPush }: Props) {
  return (
    <section className="backup-card">
      {data.degraded && (
        <p className="backup-warn" role="alert">
          {data.error || 'git 状态读取异常，下面的数字不可信。'}
        </p>
      )}
      <div className="backup-summary-head">
        <div>
          <p className="backup-kicker">本机推送分支</p>
          <h2 className="backup-branch-name">{data.ownBranch}</h2>
        </div>
        <button
          type="button"
          className="admin-button primary"
          disabled={busy || data.merging}
          onClick={onPush}
        >
          {busy ? '推送中…' : '推送本机'}
        </button>
      </div>

      <dl className="backup-meta">
        <div>
          <dt>本地检出分支</dt>
          <dd>
            <code>{data.branch || '分离 HEAD'}</code>
          </dd>
        </div>
        <div>
          <dt>远端</dt>
          <dd title={data.remote}>{data.remote || '未配置 origin'}</dd>
        </div>
        <div>
          <dt>工作区</dt>
          <dd className={data.dirty === false ? '' : 'is-warn'}>{dirtyText(data)}</dd>
        </div>
        <div>
          <dt>本机分支状态</dt>
          <dd className={data.ownBehind > 0 ? 'is-warn' : ''}>{ownState(data)}</dd>
        </div>
      </dl>

      <p className="backup-hint">
        推送会把 blog、study 与 anki 的全部改动提交后推到本机分支，不会写入其他机器的分支。
      </p>
      {data.ankiAvailable ? null : (
        <p className="backup-hint">复习数据尚未初始化；本次只会同步文章与题库。</p>
      )}
      {data.suspended && (
        <p className="backup-warn">复习已暂停：数据同步完成后会自动恢复。</p>
      )}
      {data.lastSync && (
        <p className={`backup-last${data.lastSync.ok ? '' : ' is-warn'}`}>
          最近同步 {data.lastSync.at} · {data.lastSync.branch} · {data.lastSync.message}
        </p>
      )}
    </section>
  )
}
