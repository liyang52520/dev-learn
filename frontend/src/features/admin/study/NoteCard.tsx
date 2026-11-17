import type { AdminNoteFile } from '@/types/models'

import type { DraftNote } from './bank-types'

type Props = {
  index: number
  note: DraftNote
  uploading: boolean
  onPatch: (patch: Partial<DraftNote>) => void
  onKindChange: (kind: DraftNote['kind']) => void
  onRemove: () => void
  onRemoveFile: (file: AdminNoteFile) => void
  onUpload: (files: FileList | null) => void
  onZoom: (file: AdminNoteFile, label: string) => void
}

export function NoteCard({
  index,
  note,
  uploading,
  onPatch,
  onKindChange,
  onRemove,
  onRemoveFile,
  onUpload,
  onZoom,
}: Props) {
  return (
    <div className="bank-note">
      <div className="bank-note-head">
        <input
          className="bank-input"
          value={note.label}
          placeholder={`笔记${index + 1}`}
          aria-label={`第 ${index + 1} 条笔记标题`}
          onChange={(event) => onPatch({ label: event.target.value })}
        />
        <div className="bank-note-kind" role="group" aria-label="笔记类型">
          <button
            type="button"
            className={note.kind === 'images' ? 'is-active' : ''}
            onClick={() => onKindChange('images')}
          >
            截图
          </button>
          <button
            type="button"
            className={note.kind === 'markdown' ? 'is-active' : ''}
            onClick={() => onKindChange('markdown')}
          >
            Markdown
          </button>
        </div>
        <button type="button" className="admin-button small danger" onClick={onRemove}>
          移除笔记
        </button>
      </div>

      {note.kind === 'markdown' ? (
        <textarea
          className="bank-textarea bank-note-markdown"
          rows={8}
          spellCheck={false}
          value={note.markdown}
          placeholder={'支持 Markdown：段落、- 列表、### 小标题、``` 代码块、| 表格 |'}
          aria-label={`第 ${index + 1} 条笔记 Markdown`}
          onChange={(event) => onPatch({ markdown: event.target.value })}
        />
      ) : (
        <div className="bank-note-files">
          {note.files.map((file) => (
            <figure className="bank-note-file" key={file.file}>
              <button
                type="button"
                className="bank-note-zoom"
                aria-label={`放大查看${note.label}的截图`}
                onClick={() => onZoom(file, note.label)}
              >
                <img
                  src={file.file}
                  alt={`${note.label}截图`}
                  width={file.width ?? undefined}
                  height={file.height ?? undefined}
                  loading="lazy"
                />
              </button>
              <button type="button" onClick={() => onRemoveFile(file)}>
                移除
              </button>
            </figure>
          ))}

          <div className="bank-note-upload">
            <label className="admin-button small">
              {uploading ? '上传中…' : '上传截图'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                hidden
                disabled={uploading}
                onChange={(event) => {
                  onUpload(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
