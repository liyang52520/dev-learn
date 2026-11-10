import { useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { AdminQuestion, BankTopicOption, QuestionWrite } from '@/types/models'

import { createQuestion, deleteQuestion, updateQuestion } from '../api'
import type { DraftGroup } from './bank-types'
import { EvidenceEditor } from './EvidenceEditor'
import { QuestionFields, type QuestionForm } from './QuestionFields'

type Props = {
  mode: 'new' | 'edit'
  topics: BankTopicOption[]
  initialTopicId: string
  question: AdminQuestion | null
  onSaved: (question: AdminQuestion, notice: string) => void
  onDeleted: (message: string) => void
  onCancel: () => void
}

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

export function QuestionEditor({
  mode,
  topics,
  initialTopicId,
  question,
  onSaved,
  onDeleted,
  onCancel,
}: Props) {
  const [topicId, setTopicId] = useState(question?.topicId ?? initialTopicId)
  const [form, setForm] = useState<QuestionForm>(() => ({
    title: question?.title ?? '',
    aliases: (question?.aliases ?? []).join('\n'),
    summary: (question?.summary ?? []).join('\n'),
    note: question?.note ?? '',
    pages: question?.pages ?? '',
    answer: question?.answer ?? '',
  }))
  const [groups, setGroups] = useState<DraftGroup[]>(question?.evidence ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const topic = topics.find((item) => item.id === topicId)
  const no = question?.no ?? (topic?.count ?? 0) + 1

  const patch = (value: Partial<QuestionForm>) => setForm((current) => ({ ...current, ...value }))

  const switchTopic = (next: string) => {
    if (groups.some((group) => group.files.length > 0)) {
      const ok = window.confirm('切换专题会清空已上传的截图（磁盘文件不会删除），确定继续？')
      if (!ok) return
      setGroups([])
    }
    setTopicId(next)
  }

  const payload = (): QuestionWrite => ({
    title: form.title,
    aliases: lines(form.aliases),
    summary: lines(form.summary),
    note: form.note,
    pages: form.pages,
    answer: form.answer,
    evidence: groups.map((group) => ({
      label: group.label,
      from: group.from,
      to: group.to,
      files: group.files.map((file) => ({ page: file.page, file: file.file })),
    })),
  })

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const result =
        mode === 'new'
          ? await createQuestion({ ...payload(), topicId })
          : await updateQuestion(topicId, question!.id, payload())
      onSaved(
        result.question,
        result.notice || '已保存。题目内容立即生效，卡片的学习进度没有变化。',
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!question) return
    const ok = window.confirm(
      `确定删除「${question.title}」？对应复习卡片会一起删除，后面的题号与截图名会自动前移。`,
    )
    if (!ok) return
    setSaving(true)
    setError('')
    try {
      const result = await deleteQuestion(topicId, question.id)
      const card = result.cardDeleted ? '对应复习卡片已删除。' : '未找到对应复习卡片。'
      const moved = result.reindexed ? `已迁移 ${result.reindexed} 张后续卡片。` : ''
      onDeleted(`已删除「${question.title}」。${card}${moved}`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bank-editor">
      <div className="bank-editor-head">
        <div>
          <p className="bank-kicker">
            {mode === 'new' ? 'NEW QUESTION' : `QUESTION ${question?.id}`}
          </p>
          <h2>{mode === 'new' ? '新增题目' : question?.title}</h2>
        </div>
        <div className="bank-editor-topic">
          {mode === 'new' ? (
            <select
              className="bank-input"
              value={topicId}
              aria-label="选择专题"
              onChange={(event) => switchTopic(event.target.value)}
            >
              {topics.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · 第 {(item.count ?? 0) + 1} 题
                </option>
              ))}
            </select>
          ) : (
            <span>
              {question?.topicLabel} · {question?.id}
            </span>
          )}
        </div>
      </div>

      <p className="bank-hint">
        编辑只更新题面、答案与证据，不重置卡片的学习进度和到期时间；删除题目会同时删除对应卡片。
        保存后复习页立即使用新内容。
      </p>
      {error ? <p className="bank-error">{error}</p> : null}

      <QuestionFields form={form} onChange={patch} />
      <EvidenceEditor topicId={topicId} no={no} groups={groups} onChange={setGroups} />

      <div className="bank-actions">
        {mode === 'edit' ? (
          <button
            type="button"
            className="admin-button danger"
            disabled={saving}
            onClick={() => void remove()}
          >
            删除题目
          </button>
        ) : null}
        <span className="bank-actions-spacer" />
        <button type="button" className="admin-button" disabled={saving} onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="admin-button primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? '保存中…' : mode === 'new' ? '新增题目' : '保存修改'}
        </button>
      </div>
    </div>
  )
}
