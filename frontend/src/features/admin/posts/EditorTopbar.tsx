import { Link } from 'react-router-dom'

type Props = {
  type: string
  slug: string
  title: string
  busy: string
  onSave: () => void
  onTogglePublish: () => void
  onRemove: () => void
}

export function EditorTopbar({ type, slug, title, busy, onSave, onTogglePublish, onRemove }: Props) {
  return (
    <header className="editor-topbar">
      <Link to="/admin" className="editor-back">
        ← 返回列表
      </Link>
      <div className="editor-title-wrap">
        <span className={`admin-badge ${type}`}>{type === 'drafts' ? '草稿' : '已发布'}</span>
        <strong>{title || '(无标题)'}</strong>
      </div>
      <div className="editor-actions">
        <Link className="admin-button ghost" to={`/admin/preview/${type}/${encodeURIComponent(slug)}`}>
          整页预览
        </Link>
        <button type="button" className="admin-button" onClick={onSave} disabled={busy !== ''}>
          {busy === 'save' ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          className="admin-button primary"
          onClick={onTogglePublish}
          disabled={busy !== ''}
        >
          {type === 'drafts' ? '发布' : '撤回'}
        </button>
        <button
          type="button"
          className="admin-button danger"
          onClick={onRemove}
          disabled={busy !== ''}
        >
          删除
        </button>
      </div>
    </header>
  )
}
