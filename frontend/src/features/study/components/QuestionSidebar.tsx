import { useLayoutEffect, useRef, useState } from 'react'
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
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // 只滚动左侧列表自身，且仅在当前题不在可视范围时才居中对齐。
  // 用 scrollIntoView 会连带滚动整个页面，也会把目标题压到列表最底部。
  useLayoutEffect(() => {
    const list = listRef.current
    const active = activeRef.current
    if (!list || !active) return
    const listRect = list.getBoundingClientRect()
    const itemRect = active.getBoundingClientRect()
    if (itemRect.top >= listRect.top && itemRect.bottom <= listRect.bottom) return
    const centered = list.scrollTop + itemRect.top - listRect.top - (list.clientHeight - itemRect.height) / 2
    list.scrollTop = Math.max(0, centered)
  }, [currentQid, keyword])

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

      <div className="question-list" ref={listRef}>
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
