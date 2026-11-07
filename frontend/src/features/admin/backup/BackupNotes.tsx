type Props = {
  ownBranch: string
  missingRepo?: boolean
}

export function BackupNotes({ ownBranch, missingRepo = false }: Props) {
  if (missingRepo) {
    return (
      <section className="backup-card">
        <h2>数据仓还没准备好</h2>
        <p className="backup-hint">
          <code>backend/data</code> 必须是独立 git 仓库，并且配置了 <code>origin</code>。
          主仓 <code>dev-learn</code> 会忽略整个目录，不会把数据混进站点代码。
        </p>
        <ol className="backup-steps">
          <li>
            在 <code>backend/data</code> 执行 <code>git init</code>，并添加远端：
            <code>git remote add origin &lt;dev-anki 地址&gt;</code>。
          </li>
          <li>
            本机分支默认是 <code>machine/&lt;主机名&gt;</code>；需要固定名称时设置环境变量{' '}
            <code>DATA_SYNC_BRANCH</code>。
          </li>
          <li>重启服务后刷新本页。</li>
        </ol>
        <p className="backup-hint">当前识别到的本机分支：{ownBranch || '主机名不合法'}。</p>
      </section>
    )
  }

  return (
    <section className="backup-card">
      <h2>工作方式</h2>
      <ul className="backup-notes">
        <li>
          <b>推送本机</b>：快照 Anki 后提交 blog / study / anki 的全部改动，推到{' '}
          <code>{ownBranch}</code>。服务每天也会自动做一次。
        </li>
        <li>
          <b>合并到本机</b>：把对方分支合进当前检出分支，双方改动都保留；同一文件冲突时逐个选择，
          Anki 学习状态整份二选一。
        </li>
        <li>
          <b>用对方覆盖本机</b>：本机先提交，再把工作区整份重置为对方分支；旧状态留在{' '}
          <code>refs/backup/…</code>，确认无误后再推送本机。
        </li>
        <li>合并或覆盖期间 Anki collection 会关闭，复习接口短暂返回 503。</li>
      </ul>
    </section>
  )
}
