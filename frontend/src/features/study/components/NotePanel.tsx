import { useState } from 'react'

import { HtmlContent } from '@/shared/components/HtmlContent'
import { ImageLightbox } from '@/shared/components/ImageLightbox'
import type { StudyNote } from '@/types/models'

type Props = { notes: StudyNote[]; className?: string; onClose?: () => void }

function headSide(notes: StudyNote[], onClose?: () => void) {
  return (
    <div className="note-head-side">
      <span>{notes.length} 条</span>
      {onClose && (
        <button type="button" className="note-close" aria-label="关闭笔记" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}

export function NotePanel({ notes, className, onClose }: Props) {
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null)
  const rootClass = className ?? 'study-notes'

  if (notes.length === 0) {
    return (
      <aside className={rootClass}>
        <div className="note-head">
          <h2>笔记</h2>
        </div>
        <p className="note-empty">本题暂无笔记。</p>
      </aside>
    )
  }

  return (
    <>
      <aside className={rootClass}>
        <div className="note-head">
          <h2>笔记</h2>
          {headSide(notes, onClose)}
        </div>
        {notes.map((note, index) => (
          <section
            className={note.kind === 'markdown' ? 'note-group note-group-wide' : 'note-group'}
            key={`${note.label}-${index}`}
          >
            <header>
              <strong>{note.label}</strong>
              {note.kind === 'images' && <span>{note.files.length} 张</span>}
            </header>
            {note.kind === 'markdown' ? (
              <HtmlContent className="prose note-markdown" html={note.html} />
            ) : (
              note.files.map((file) => (
                <button
                  key={file.file}
                  type="button"
                  className="note-shot"
                  onClick={() => setZoom({ src: file.file, label: note.label })}
                >
                  <img
                    src={file.file}
                    alt={note.label}
                    loading="lazy"
                    decoding="async"
                    width={file.width ?? undefined}
                    height={file.height ?? undefined}
                  />
                </button>
              ))
            )}
          </section>
        ))}
      </aside>

      {zoom && (
        <ImageLightbox
          src={zoom.src}
          alt={zoom.label}
          caption={zoom.label}
          onClose={() => setZoom(null)}
        />
      )}
    </>
  )
}
