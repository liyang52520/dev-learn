import { Link } from 'react-router-dom'

import type { PostMeta } from '@/types/models'

export type AdminRow = PostMeta & { kind: 'posts' | 'drafts' }

type Props = {
  rows: AdminRow[]
  loading: boolean
  busy: string
  onTogglePublish: (kind: AdminRow['kind'], slug: string) => void
  onRemove: (kind: AdminRow['kind'], slug: string) => void
}

export function AdminPostTable({ rows, loading, busy, onTogglePublish, onRemove }: Props) {
  return (
    <div className="admin-table">
      <div className="admin-table-head">
        <span>状态</span>
        <span>标题</span>
        <span>日期</span>
        <span>分类 / 标签</span>
        <span>操作</span>
      </div>
      {loading && <div className="admin-table-empty">正在加载…</div>}
      {!loading && rows.length === 0 && <div className="admin-table-empty">没有匹配的文章。</div>}
      {rows.map((row) => (
        <div className="admin-row" key={`${row.kind}-${row.slug}`}>
          <span className={`admin-badge ${row.kind}`}>{row.kind === 'drafts' ? '草稿' : '已发布'}</span>
          <Link to={`/admin/edit/${row.kind}/${encodeURIComponent(row.slug)}`} className="admin-row-title">
            {row.title}
            {row.excerpt && <small>{row.excerpt}</small>}
          </Link>
          <span className="admin-row-date">{row.displayDate}</span>
          <span className="admin-row-tax">
            {row.categories.length > 0 && (
              <span className="admin-row-cats">{row.categories.join(' / ')}</span>
            )}
            {row.tags.length > 0 && (
              <span className="admin-row-tags">
                {row.tags
                  .slice(0, 3)
                  .map((tag) => `#${tag}`)
                  .join(' ')}
              </span>
            )}
            {row.categories.length === 0 && row.tags.length === 0 && (
              <span className="admin-row-tags">—</span>
            )}
          </span>
          <span className="admin-row-actions">
            <Link to={`/admin/edit/${row.kind}/${encodeURIComponent(row.slug)}`}>编辑</Link>
            <Link to={`/admin/preview/${row.kind}/${encodeURIComponent(row.slug)}`}>预览</Link>
            <button
              type="button"
              onClick={() => onTogglePublish(row.kind, row.slug)}
              disabled={busy === row.slug}
            >
              {row.kind === 'drafts' ? '发布' : '撤销'}
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => onRemove(row.kind, row.slug)}
              disabled={busy === row.slug}
            >
              删除
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
