import type { BackupRef as BackupRefItem } from '@/types/models'

type Props = {
  refs: BackupRefItem[]
  busy: boolean
  onRestore: (item: BackupRefItem) => void
}

/** 覆盖/恢复前自动留下的安全引用；没有恢复入口的备份不算备份。 */
export function SafetyRefs({ refs, busy, onRestore }: Props) {
  if (refs.length === 0) return null
  return (
    <section className="backup-card">
      <h2>安全引用</h2>
      <p className="backup-hint">
        覆盖或恢复前自动留下的快照。恢复到这里之前会先把当前状态再存一份，不会丢东西。
      </p>
      <ul className="backup-refs">
        {refs.slice(0, 10).map((item) => (
          <li key={item.ref}>
            <div className="backup-ref-meta">
              <code>{item.name}</code>
              <span>
                {item.createdAt} · {item.sha}
              </span>
            </div>
            <button
              type="button"
              className="admin-button"
              disabled={busy}
              onClick={() => onRestore(item)}
            >
              恢复到这里
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
