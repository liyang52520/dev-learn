type Props = {
  title: string
  busy: boolean
  onTitleChange: (value: string) => void
  onClose: () => void
  onCreate: () => void
}

export function NewPostModal({ title, busy, onTitleChange, onClose, onCreate }: Props) {
  return (
    <div className="admin-modal-overlay" onMouseDown={onClose}>
      <div className="admin-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="admin-modal-head">
          <h2>新建文章</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <label className="admin-field">
          <span>标题</span>
          <input
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="例如：Spring 事务为什么会失效"
            autoFocus
          />
        </label>
        <p className="admin-modal-hint">创建后会写入 blog/drafts，随后进入编辑器。</p>
        <div className="admin-modal-actions">
          <button type="button" className="admin-button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="admin-button primary" onClick={onCreate} disabled={busy}>
            {busy ? '创建中…' : '创建草稿'}
          </button>
        </div>
      </div>
    </div>
  )
}
