import { useEffect, useState } from 'react'

import type { BackupConflict } from '@/types/models'

type Props = {
  branch: string
  conflicts: BackupConflict[]
  busy: boolean
  onResolve: (resolutions: Record<string, 'local' | 'remote'>) => void
  onAbort: () => void
}

type Choice = 'local' | 'remote'

export function MergeConflictPanel({ branch, conflicts, busy, onResolve, onAbort }: Props) {
  // 不预选任何一侧：冲突必须由用户明确决定，避免一路回车把远端覆盖掉。
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const missing = conflicts.filter((item) => !choices[item.path]).length

  // 轮询会换掉 conflicts 数组；只为新增冲突保留空选择，不覆盖用户已做的决定。
  useEffect(() => {
    setChoices((prev) => {
      const next: Record<string, Choice> = {}
      for (const item of conflicts) {
        if (prev[item.path]) next[item.path] = prev[item.path]
      }
      return next
    })
  }, [conflicts])

  const resolve = () => {
    if (missing > 0) return
    const ok = window.confirm(
      `按当前选择完成合并？共 ${conflicts.length} 个文件。\n\n合并后改动仍在本机，确认无误再点「推送本机」。`,
    )
    if (ok) onResolve(choices)
  }

  return (
    <section className="backup-card backup-conflict">
      <div className="backup-conflict-head">
        <div>
          <p className="backup-kicker">冲突待处理</p>
          <h2>合并 {branch || '远端分支'} 时发现冲突</h2>
        </div>
        <span className="backup-badge is-warn">{conflicts.length} 个文件</span>
      </div>
      <p className="backup-warn">
        合并完成前复习暂停。每个文件整份选择保留本机或采用对方；不会自动替你决定。
        {missing > 0 ? ` 还有 ${missing} 个文件未选择。` : ' 所有冲突都已选择。'}
      </p>
      <div className="backup-conflicts">
        {conflicts.map((item) => (
          <div className="backup-conflict-row" key={item.path}>
            <div>
              <code>{item.path}</code>
              <p className="backup-branch-meta">
                {item.kind === 'anki'
                  ? 'Anki 学习状态是二进制文件，只能整份选择；未选中那侧自上次同步以来的学习记录会丢失。'
                  : '文本文件，整份选择一侧，不做逐行合并。'}
              </p>
            </div>
            <div className="backup-choice">
              {(
                [
                  ['local', '保留本机'],
                  ['remote', '采用对方'],
                ] as const
              ).map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`resolve-${item.path}`}
                    value={value}
                    checked={choices[item.path] === value}
                    onChange={() => setChoices((prev) => ({ ...prev, [item.path]: value }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="backup-actions">
        <button type="button" className="admin-button" disabled={busy} onClick={onAbort}>
          取消合并
        </button>
        <button
          type="button"
          className="admin-button primary"
          disabled={busy || missing > 0}
          onClick={resolve}
        >
          {busy ? '处理中…' : missing > 0 ? `还差 ${missing} 个文件` : '完成合并'}
        </button>
      </div>
    </section>
  )
}
