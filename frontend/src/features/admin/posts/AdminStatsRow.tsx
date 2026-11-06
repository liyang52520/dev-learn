type Props = {
  posts?: number
  drafts?: number
  categories: number
}

function show(value?: number) {
  return value ?? '—'
}

export function AdminStatsRow({ posts, drafts, categories }: Props) {
  return (
    <div className="admin-stats">
      <div>
        <span>已发布</span>
        <strong>{show(posts)}</strong>
      </div>
      <div>
        <span>草稿</span>
        <strong>{show(drafts)}</strong>
      </div>
      <div>
        <span>分类</span>
        <strong>{categories || '—'}</strong>
      </div>
      <div className="admin-stats-note">
        <span>存储位置</span>
        <code>blog/posts · blog/drafts</code>
      </div>
    </div>
  )
}
