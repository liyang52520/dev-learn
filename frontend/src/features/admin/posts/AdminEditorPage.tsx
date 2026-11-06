import { useParams } from 'react-router-dom'

import { AdminTopbar } from '../AdminTopbar'
import { ApiError } from '@/shared/api/client'
import { HtmlContent } from '@/shared/components/HtmlContent'
import { useTheme } from '@/shared/hooks'
import { EditorMetaPanel } from './EditorMetaPanel'
import { EditorTopbar } from './EditorTopbar'
import { MarkdownEditor } from './MarkdownEditor'
import { usePostEditor } from './usePostEditor'

export default function AdminEditorPage() {
  const { type = 'drafts', slug = '' } = useParams()
  const { theme } = useTheme()
  const editor = usePostEditor(type, slug)
  const { front, body, setBody, notice, busy, mode, setMode, preview, insertRef, uploadRef } = editor

  const shell = (text: string) => (
    <div className="admin-root">
      <AdminTopbar />
      <div className="admin-page">
        <div className="admin-table-empty">{text}</div>
      </div>
    </div>
  )

  if (editor.error instanceof ApiError && editor.error.status === 404) return shell('文章不存在。')
  if (editor.isPending || !editor.ready) return shell('正在加载…')

  return (
    <div className="admin-editor-page">
      <AdminTopbar />
      <EditorTopbar
        type={type}
        slug={slug}
        title={front.title}
        busy={busy}
        onSave={() => void editor.save()}
        onTogglePublish={() => void editor.togglePublish()}
        onRemove={() => void editor.remove()}
      />

      {notice && <div className="editor-notice">{notice}</div>}

      <div className="editor-layout">
        <EditorMetaPanel
          front={front}
          slug={slug}
          bodyLength={body.length}
          onChange={editor.update}
        />

        <main className="editor-main">
          <div className="editor-toolbar">
            <div className="editor-modes">
              <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
                编辑
              </button>
              <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>
                预览
              </button>
            </div>
            <div className="editor-tools">
              <input
                ref={uploadRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void editor.upload(file)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                className="admin-button small"
                onClick={() => uploadRef.current?.click()}
                disabled={busy === 'upload'}
              >
                {busy === 'upload' ? '上传中…' : '插入图片'}
              </button>
              <span className="editor-shortcut">⌘S 保存</span>
            </div>
          </div>
          <div className={mode === 'preview' ? 'editor-body is-preview' : 'editor-body'}>
            <MarkdownEditor
              value={body}
              onChange={setBody}
              dark={theme === 'dark'}
              docKey={`${type}/${slug}`}
              onReady={(insert) => {
                insertRef.current = insert
              }}
              onSave={() => void editor.save()}
            />
            <div className="editor-preview-pane">
              {preview ? (
                <HtmlContent html={preview} className="prose" />
              ) : (
                <p className="editor-preview-status">正在生成预览…</p>
              )}
            </div>
          </div>
          <footer className="editor-statusbar">
            <span>{notice || '未保存的修改会在切换页面后丢失'}</span>
            <span className="editor-status-right">{slug}.md</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
