import { useCallback, useEffect, useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { AdminQuestion, BankListResponse } from '@/types/models'

import { fetchAdminQuestion, fetchQuestionBank } from '../api'
import { QuestionEditor } from './QuestionEditor'
import { QuestionList } from './QuestionList'

export function StudyBankTab() {
  const [bank, setBank] = useState<BankListResponse | null>(null)
  const [topic, setTopic] = useState('')
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
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
      setError('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [topic, keyword])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const openQuestion = async (topicId: string, qid: string) => {
    setCreating(false)
    setNotice('')
    setError('')
    try {
      const question = await fetchAdminQuestion(topicId, qid)
      setDetail(question)
      setActiveKey(question.key)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const startNew = () => {
    const fallback = topic || bank?.topics[0]?.id || ''
    if (!fallback) {
      setError('题库里还没有专题，无法新增题目。')
      return
    }
    setNewTopic(fallback)
    setCreating(true)
    setDetail(null)
    setActiveKey('')
    setNotice('')
    setError('')
    setNewSeq((value) => value + 1)
  }

  const saved = (question: AdminQuestion, message: string) => {
    setCreating(false)
    setDetail(question)
    setActiveKey(question.key)
    setNotice(message)
    void loadList()
  }

  const deleted = (message: string) => {
    setCreating(false)
    setDetail(null)
    setActiveKey('')
    setNotice(message)
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
        {notice ? <p className="bank-notice">{notice}</p> : null}
        {error ? <p className="bank-error">{error}</p> : null}
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
    </div>
  )
}
