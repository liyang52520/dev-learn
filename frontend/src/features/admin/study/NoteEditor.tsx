import { useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import { ImageLightbox } from '@/shared/components/ImageLightbox'
import type { AdminNoteFile } from '@/types/models'

import { uploadNote } from '../api'
import { AdminToast } from '../AdminToast'
import type { DraftNote } from './bank-types'
import { NoteCard } from './NoteCard'

type Props = {
  topicId: string
  no: number
  notes: DraftNote[]
  onChange: (notes: DraftNote[]) => void
}

const EMPTY = { files: [], markdown: '' }

function nextLabel(notes: DraftNote[]): string {
  const used = new Set(notes.map((note) => note.label))
  let index = notes.length + 1
  while (used.has(`笔记${index}`)) index += 1
  return `笔记${index}`
}

export function NoteEditor({ topicId, no, notes, onChange }: Props) {
  const [uploading, setUploading] = useState(-1)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState<{ file: AdminNoteFile; label: string } | null>(null)

  const update = (index: number, patch: Partial<DraftNote>) => {
    onChange(notes.map((note, position) => (position === index ? { ...note, ...patch } : note)))
  }

  const addNote = () => {
    onChange([...notes, { label: nextLabel(notes), kind: 'images', ...EMPTY }])
  }

  const setKind = (index: number, kind: DraftNote['kind']) => {
    const note = notes[index]
    if (note.kind === kind) return
    if (note.files.length > 0 || note.markdown.trim()) {
      const target = kind === 'markdown' ? 'Markdown' : '截图'
      const ok = window.confirm(`切换为${target}会清空这条笔记当前的内容，确定继续？`)
      if (!ok) return
    }
    update(index, { kind, ...EMPTY })
  }

  const upload = async (index: number, files: FileList | null) => {
    if (!files?.length) return
    setUploading(index)
    setError('')
    try {
      const uploaded: AdminNoteFile[] = []
      for (const file of Array.from(files)) {
        const result = await uploadNote(topicId, file, { no, group: index })
        uploaded.push({ file: result.file, width: result.width, height: result.height })
      }
      onChange(
        notes.map((note, position) =>
          position === index ? { ...note, files: [...note.files, ...uploaded] } : note,
        ),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading(-1)
    }
  }

  return (
    <section className="bank-field wide">
      <div className="bank-note-bar">
        <span className="bank-label">笔记</span>
        <button type="button" className="admin-button small" onClick={addNote}>
          添加笔记
        </button>
      </div>
      <p className="bank-hint">
        笔记可以先不写，之后再补。每条笔记只能二选一：上传截图或写 Markdown；不同笔记之间互不影响。
        截图保存在当前专题的 assets/ev 目录，删除题目时会一并清理。
      </p>

      {notes.map((note, index) => (
        <NoteCard
          key={index}
          index={index}
          note={note}
          uploading={uploading === index}
          onPatch={(patch) => update(index, patch)}
          onKindChange={(kind) => setKind(index, kind)}
          onRemove={() => onChange(notes.filter((_, position) => position !== index))}
          onRemoveFile={(file) =>
            update(index, {
              files: note.files.filter((item) => item.file !== file.file),
            })
          }
          onUpload={(files) => void upload(index, files)}
          onZoom={(file, label) => setZoom({ file, label })}
        />
      ))}

      <AdminToast
        notice={error ? { tone: 'error', text: error } : null}
        onClose={() => setError('')}
      />

      {zoom && (
        <ImageLightbox
          src={zoom.file.file}
          alt={`${zoom.label}截图`}
          caption={zoom.label}
          onClose={() => setZoom(null)}
        />
      )}
    </section>
  )
}
