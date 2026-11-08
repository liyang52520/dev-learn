import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { BackupRef, BackupResult } from '@/types/models'

import { AdminTopbar } from '../AdminTopbar'
import {
  abortBackup,
  fetchBackupRemote,
  fetchBackupStatus,
  mergeBackup,
  overwriteBackup,
  pushBackup,
  resolveBackup,
  restoreBackup,
} from '../api'
import { BackupNotes } from './BackupNotes'
import { BackupSummary } from './BackupSummary'
import { MergeConflictPanel } from './MergeConflictPanel'
import { RemoteBranchList } from './RemoteBranchList'
import { SafetyRefs } from './SafetyRefs'

type Notice = { ok: boolean; text: string } | null

export default function AdminBackupPage() {
  const client = useQueryClient()
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'backup'],
    queryFn: fetchBackupStatus,
    refetchInterval: 15_000,
    retry: false,
  })

  const run = async (key: string, action: () => Promise<BackupResult>) => {
    setBusy(key)
    setNotice(null)
    try {
      const result = await action()
      setNotice({ ok: result.ok, text: result.message })
    } catch (reason) {
      setNotice({ ok: false, text: errorMessage(reason) })
    } finally {
      setBusy('')
      await client.invalidateQueries({ queryKey: ['admin', 'backup'] })
    }
  }

  const merge = (branch: string) => {
    const ok = window.confirm(
      `把 ${branch} 合并到本机？\n\n合并会先保存本机改动；如果两边改了同一文件，会暂停复习并让你逐个选择保留哪一侧。`,
    )
    if (ok) void run(`merge:${branch}`, () => mergeBackup(branch))
  }

  const overwrite = (branch: string) => {
    const ok = window.confirm(
      `用 ${branch} 覆盖本机？\n\n会先提交并保留 refs/backup 安全引用，但本机文章、题库和 Anki 学习进度都会被整份替换。`,
    )
    if (ok) void run(`overwrite:${branch}`, () => overwriteBackup(branch))
  }

  const restore = (item: BackupRef) => {
    const ok = window.confirm(
      `恢复到 ${item.name}（${item.sha}）？\n\n会先把当前状态提交并留一个新的安全引用，再整份回到这个时间点。`,
    )
    if (ok) void run(`restore:${item.ref}`, () => restoreBackup(item.ref))
  }

  return (
    <>
      <AdminTopbar />
      <main className="admin-page">
        <div className="admin-page-head">
          <div>
            <p className="admin-kicker">DATA SYNC</p>
            <h1>数据备份</h1>
            <p className="admin-lede">
              每台机器只写自己的远端分支。可以把别的机器分支合并到本机，或整份覆盖本机。
            </p>
          </div>
          <div className="admin-head-actions">
            <button
              type="button"
              className="admin-button"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {isFetching ? '刷新中…' : '刷新'}
            </button>
          </div>
        </div>

        {notice && (
          <div className={`backup-notice${notice.ok ? '' : ' is-error'}`}>{notice.text}</div>
        )}

        {isLoading && !data && <p className="muted">正在读取仓库状态…</p>}
        {!isLoading && !data && (
          <div className="backup-card">
            <h2>读取失败</h2>
            <p className="backup-hint">{error ? errorMessage(error) : '没有读到备份状态。'}</p>
            <button type="button" className="admin-button" onClick={() => void refetch()}>
              重试
            </button>
          </div>
        )}

        {data && !data.repo && <BackupNotes ownBranch={data.ownBranch} missingRepo />}
        {data && data.repo && (
          <>
            <BackupSummary
              data={data}
              busy={busy === 'push'}
              onPush={() => void run('push', pushBackup)}
            />
            {data.merging && (
              <MergeConflictPanel
                branch={data.mergeBranch}
                conflicts={data.conflicts}
                busy={busy === 'resolve' || busy === 'abort'}
                onResolve={(choices) => void run('resolve', () => resolveBackup(choices))}
                onAbort={() => void run('abort', abortBackup)}
              />
            )}
            <RemoteBranchList
              branches={data.branches}
              busy={busy !== '' || data.merging}
              fetching={busy === 'fetch'}
              onFetch={() => void run('fetch', fetchBackupRemote)}
              onMerge={merge}
              onOverwrite={overwrite}
            />
            <SafetyRefs
              refs={data.safetyRefs ?? []}
              busy={busy !== '' || data.merging}
              onRestore={restore}
            />
            <BackupNotes ownBranch={data.ownBranch} />
          </>
        )}
      </main>
    </>
  )
}
