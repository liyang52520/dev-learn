import { useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { AdminEvidenceFile } from '@/types/models'

import { uploadEvidence } from '../api'
import { AdminToast } from '../AdminToast'
import type { DraftGroup } from './bank-types'

type Props = {
  topicId: string
  no: number
  groups: DraftGroup[]
  onChange: (groups: DraftGroup[]) => void
}

export function EvidenceEditor({ topicId, no, groups, onChange }: Props) {
  const [pages, setPages] = useState<Record<number, number>>({})
  const [uploading, setUploading] = useState('')
  const [error, setError] = useState('')

  const update = (index: number, patch: Partial<DraftGroup>) => {
    onChange(groups.map((group, position) => (position === index ? { ...group, ...patch } : group)))
  }

  const addGroup = () => {
    const last = groups[groups.length - 1]
    onChange([
      ...groups,
      {
        label: groups.length === 0 ? '原文出处' : `出处 ${groups.length + 1}`,
        from: last?.to ?? 1,
        to: last?.to ?? 1,
        files: [],
      },
    ])
  }

  const removeGroup = (index: number) => {
    onChange(groups.filter((_, position) => position !== index))
  }

  const removeFile = (groupIndex: number, file: AdminEvidenceFile) => {
    update(groupIndex, {
      files: groups[groupIndex].files.filter((item) => item.file !== file.file),
    })
  }

  const upload = async (index: number, files: FileList | null) => {
    if (!files?.length) return
    const page = pages[index] ?? groups[index].from
    setUploading(String(index))
    setError('')
    try {
      const uploaded: AdminEvidenceFile[] = []
      for (const file of Array.from(files)) {
        const result = await uploadEvidence(topicId, file, { no, group: index, page })
        uploaded.push({ page, file: result.file, width: result.width, height: result.height })
      }
      update(index, { files: [...groups[index].files, ...uploaded] })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setUploading('')
    }
  }

  return (
    <section className="bank-field wide">
      <div className="bank-evidence-head">
        <span className="bank-label">证据截图</span>
        <button type="button" className="admin-button small" onClick={addGroup}>
          添加出处
        </button>
      </div>
      <p className="bank-hint">
        证据截图可以先不传，之后再补。截图按「q题号_出处序号_页码」命名，保存在当前专题的
        assets/ev 目录；删除题目时会一并清理。
      </p>

      {groups.map((group, index) => (
        <div className="bank-evidence-group" key={index}>
          <div className="bank-evidence-group-head">
            <input
              className="bank-input"
              value={group.label}
              placeholder="出处标签"
              aria-label={`第 ${index + 1} 组出处标签`}
              onChange={(event) => update(index, { label: event.target.value })}
            />
            <label className="bank-page-input">
              起
              <input
                className="bank-input"
                type="number"
                min={1}
                value={group.from}
                onChange={(event) => update(index, { from: Number(event.target.value) || 1 })}
              />
            </label>
            <label className="bank-page-input">
              止
              <input
                className="bank-input"
                type="number"
                min={1}
                value={group.to}
                onChange={(event) => update(index, { to: Number(event.target.value) || 1 })}
              />
            </label>
            <button
              type="button"
              className="admin-button small danger"
              onClick={() => removeGroup(index)}
            >
              移除出处
            </button>
          </div>

          <div className="bank-evidence-files">
            {group.files.map((file) => (
              <figure className="bank-evidence-file" key={file.file}>
                <img
                  src={file.file}
                  alt={`第 ${file.page} 页证据截图`}
                  width={file.width ?? undefined}
                  height={file.height ?? undefined}
                  loading="lazy"
                />
                <figcaption>p{file.page}</figcaption>
                <button type="button" onClick={() => removeFile(index, file)}>
                  移除
                </button>
              </figure>
            ))}

            <div className="bank-evidence-upload">
              <label className="admin-button small">
                {uploading === String(index) ? '上传中…' : '上传截图'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  disabled={uploading !== ''}
                  onChange={(event) => {
                    void upload(index, event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
              <label className="bank-page-input">
                页码
                <input
                  className="bank-input"
                  type="number"
                  min={1}
                  value={pages[index] ?? group.from}
                  onChange={(event) =>
                    setPages((current) => ({
                      ...current,
                      [index]: Number(event.target.value) || 1,
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </div>
      ))}

      <AdminToast
        notice={error ? { tone: 'error', text: error } : null}
        onClose={() => setError('')}
      />
    </section>
  )
}
