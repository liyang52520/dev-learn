import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { ChevronDownIcon, SearchIcon } from '@/shared/components/Icons'
import type { TopicDetail } from '@/types/models'

type Props = {
  topic: TopicDetail
  currentQid: string
}

export function QuestionSidebar({ topic, currentQid }: Props) {
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (activeRef.current) activeRef.current.scrollIntoView({ block: 'nearest' })
  }, [currentQid])

  const needle = keyword.trim().toLowerCase()
  const questions = needle
    ? topic.questions.filter((question) =>
        `${question.no} ${question.title} ${question.aliases.join(' ')}`.toLowerCase().includes(needle),
      )
    : topic.questions

  return (
    <aside className={open ? 'study-sidebar is-open' : 'study-sidebar'} aria-label="题目列表">
      <div className="study-sidebar-head">
        <Link to="/study" className="study-back">
          ← 全部专题
        </Link>

        <div className="study-sidebar-title">
          <h2>{topic.title}</h2>
          <span>
            {topic.no} · {topic.count} 题
          </span>
        </div>

        <div className="study-search">
          <SearchIcon className="icon" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={`在 ${topic.count} 题中筛选…`}
            aria-label="筛选题目"
          />
          <kbd>/</kbd>
        </div>

        <button type="button" className="study-nav-toggle" onClick={() => setOpen((value) => !value)}>
          题目列表
          <span className="study-nav-toggle-count">{questions.length}</span>
          <ChevronDownIcon className={open ? 'icon study-nav-toggle-chevron is-open' : 'icon study-nav-toggle-chevron'} />
        </button>
      </div>

      <div className="question-list">
        {questions.length === 0 ? (
          <p className="question-empty">没有匹配的题目。</p>
        ) : (
          questions.map((question) => {
            const active = question.id === currentQid
            return (
              <Link
                key={question.id}
                ref={active ? activeRef : undefined}
                to={`/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(question.id)}`}
                className={active ? 'question-item active' : 'question-item'}
              >
                <span className="question-no">{question.no}</span>
                <span className="question-title">{question.title}</span>
              </Link>
            )
          })
        )}
      </div>

      <p className="study-sidebar-foot">
        <span>{topic.count} 题</span>
        <span>{topic.pages} 页原文</span>
      </p>
    </aside>
  )
}
