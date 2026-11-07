import type { BackupBranch } from '@/types/models'

import { BackupBranchRow } from './BackupBranchRow'

type Props = {
  branches: BackupBranch[]
  busy: boolean
  fetching: boolean
  onFetch: () => void
  onMerge: (branch: string) => void
  onOverwrite: (branch: string) => void
}

export function RemoteBranchList({
  branches,
  busy,
  fetching,
  onFetch,
  onMerge,
  onOverwrite,
}: Props) {
  return (
    <section className="backup-card">
      <div className="backup-list-head">
        <h2>远端分支</h2>
        <button type="button" className="admin-button small" disabled={fetching} onClick={onFetch}>
          {fetching ? '获取中…' : '获取远端分支'}
        </button>
      </div>
      <p className="backup-hint">
        每台机器只写自己的分支。需要另一台机器上的文章、题库或学习进度时，
        合并会保留双方改动；覆盖会整份替换本机，并在本机留一个安全引用。
      </p>
      {branches.length === 0 ? (
        <p className="backup-empty">远端还没有任何分支；先点上方「推送本机」。</p>
      ) : (
        <div className="backup-branches">
          {branches.map((branch) => (
            <BackupBranchRow
              key={branch.name}
              branch={branch}
              busy={busy}
              onMerge={onMerge}
              onOverwrite={onOverwrite}
            />
          ))}
        </div>
      )}
    </section>
  )
}
