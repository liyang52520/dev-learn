import type { BackupBranch } from '@/types/models'

type Props = {
  branch: BackupBranch
  busy: boolean
  onMerge: (branch: string) => void
  onOverwrite: (branch: string) => void
}

function position(branch: BackupBranch): string {
  if (branch.ahead === 0 && branch.behind === 0) return '与本地一致'
  if (branch.ahead > 0 && branch.behind > 0) {
    return `本地多 ${branch.ahead} 个提交，远端多 ${branch.behind} 个提交`
  }
  if (branch.behind > 0) return `远端多 ${branch.behind} 个提交`
  return `本地多 ${branch.ahead} 个提交`
}

function shortTime(value: string): string {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 16)
}

export function BackupBranchRow({ branch, busy, onMerge, onOverwrite }: Props) {
  return (
    <div className={`backup-branch${branch.isOwn ? ' is-own' : ''}`}>
      <div className="backup-branch-main">
        <div className="backup-branch-title">
          <code>{branch.name}</code>
          {branch.isOwn && <span className="backup-badge">本机</span>}
        </div>
        <p className="backup-branch-meta">
          {branch.sha} · {shortTime(branch.updatedAt)} · {position(branch)}
        </p>
      </div>
      {branch.isOwn ? (
        <span className="backup-branch-note">只由本机推送</span>
      ) : (
        <div className="backup-branch-actions">
          <button
            type="button"
            className="admin-button small"
            disabled={busy}
            onClick={() => onMerge(branch.name)}
          >
            合并到本机
          </button>
          <button
            type="button"
            className="admin-button small danger"
            disabled={busy}
            onClick={() => onOverwrite(branch.name)}
          >
            用对方覆盖本机
          </button>
        </div>
      )}
    </div>
  )
}
