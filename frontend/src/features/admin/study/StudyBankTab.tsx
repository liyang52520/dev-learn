import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { errorMessage } from '@/shared/api/client'
import type { AdminQuestion, BankListResponse } from '@/types/models'

import { AdminToast, type AdminNotice } from '../AdminToast'
import { fetchAdminQuestion, fetchQuestionBank } from '../api'
import { QuestionEditor } from './QuestionEditor'
import { QuestionList } from './QuestionList'

export function StudyBankTab() {
  // 支持 /admin/study?tab=bank&topic=<topicId>&qid=<题号> 直接打开某道题（复习页跳编辑用）
  const [params] = useSearchParams()
  const [bank, setBank] = useState<BankListResponse | null>(null)
  const [topic, setTopic] = useState(() => params.get('topic') || '')
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<AdminNotice | null>(null)
  const [activeKey, setActiveKey] = useState('')
  const [detail, setDetail] = useState<AdminQuestion | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTopic, setNewTopic] = useState('')
  const [newSeq, setNewSeq] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(search.trim()), 260)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      setBank(await fetchQuestionBank(topic, keyword))
    } catch (err) {
      setFeedback({ tone: 'error', text: errorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [topic, keyword])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const openQuestion = useCallback(async (topicId: string, qid: string) => {
    setCreating(false)
    setFeedback(null)
    try {
      const question = await fetchAdminQuestion(topicId, qid)
      setDetail(question)
      setActiveKey(question.key)
    } catch (err) {
      setFeedback({ tone: 'error', text: errorMessage(err) })
    }
  }, [])

  useEffect(() => {
    const topicId = params.get('topic')
    const qid = params.get('qid')
    if (topicId && qid) void openQuestion(topicId, qid)
  }, [params, openQuestion])

  const startNew = () => {
    const fallback = topic || bank?.topics[0]?.id || ''
    if (!fallback) {
      setFeedback({ tone: 'error', text: '题库里还没有专题，无法新增题目。' })
      return
    }
    setNewTopic(fallback)
    setCreating(true)
    setDetail(null)
    setActiveKey('')
    setFeedback(null)
    setNewSeq((value) => value + 1)
  }

  const saved = (question: AdminQuestion, message: string) => {
    setCreating(false)
    setDetail(question)
    setActiveKey(question.key)
    setFeedback({ tone: 'success', text: message })
    void loadList()
  }

  const deleted = (message: string) => {
    setCreating(false)
    setDetail(null)
    setActiveKey('')
    setFeedback({ tone: 'success', text: message })
    void loadList()
  }

  const topics = bank?.topics ?? []

  return (
    <div className="bank-layout">
      <QuestionList
        topics={topics}
        rows={bank?.questions ?? []}
        total={bank?.total ?? 0}
        limited={bank?.limited ?? false}
        loading={loading}
        topic={topic}
        keyword={search}
        activeKey={activeKey}
        onTopicChange={(next) => {
          setTopic(next)
          setActiveKey('')
          setDetail(null)
          setCreating(false)
        }}
        onKeywordChange={setSearch}
        onCreate={startNew}
        onSelect={(topicId, qid) => void openQuestion(topicId, qid)}
      />

      <div className="bank-main">
        {creating ? (
          <QuestionEditor
            key={`new-${newSeq}`}
            mode="new"
            topics={topics}
            initialTopicId={newTopic}
            question={null}
            onSaved={saved}
            onDeleted={deleted}
            onCancel={() => setCreating(false)}
          />
        ) : detail ? (
          <QuestionEditor
            key={detail.key}
            mode="edit"
            topics={topics}
            initialTopicId={detail.topicId}
            question={detail}
            onSaved={saved}
            onDeleted={deleted}
            onCancel={() => setDetail(null)}
          />
        ) : (
          <div className="bank-placeholder">
            <h2>选择一道题开始编辑</h2>
            <p>
              左侧可以按专题筛选或搜索标题、要点与答案。新增题目会追加到所选专题末尾；删除中间题目后，
              后续题号、截图名和对应卡片会自动前移。
            </p>
          </div>
        )}
      </div>

      <AdminToast notice={feedback} onClose={() => setFeedback(null)} />
    </div>
  )
}
