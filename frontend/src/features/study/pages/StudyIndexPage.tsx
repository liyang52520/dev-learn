import { useState } from 'react'

import { SearchIcon } from '@/shared/components/Icons'
import { ReviewLauncher } from '../components/ReviewLauncher'
import { TopicCard } from '../components/TopicCard'
import { useStudyIndex } from '../hooks'

export default function StudyIndexPage() {
  const { data, isPending } = useStudyIndex()
  const [keyword, setKeyword] = useState('')

  const topics = data?.topics ?? []
  const needle = keyword.trim().toLowerCase()
  const filtered = needle
    ? topics.filter((topic) =>
        `${topic.no} ${topic.title} ${topic.label} ${topic.subtitle}`.toLowerCase().includes(needle),
      )
    : topics

  return (
    <div className="page-shell study-home">
      <header className="page-hero study-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          INTERVIEW NOTES
        </p>
        <h1>
          {data ? `${data.meta.topics} 个专题，` : '正在加载专题，'}
          <br />
          <span className="serif">{data ? `${data.meta.count.toLocaleString('en-US')} 道题。` : '…'}</span>
        </h1>
        <p>题干原文逐字还原，代码、表格、插图不做改写；每道题右侧附 PDF 原始页截图，来源可查。</p>
        <div className="study-hero-stats">
          <span>
            <strong>{data?.meta.topics ?? '—'}</strong> 专题
          </span>
          <span>
            <strong>{data?.meta.count.toLocaleString('en-US') ?? '—'}</strong> 题目
          </span>
          <span>
            <strong>{data?.meta.pages.toLocaleString('en-US') ?? '—'}</strong> 页原文
          </span>
        </div>
      </header>

      <ReviewLauncher />

      <div className="study-browser-bar">
        <div className="study-browser-search">
          <SearchIcon className="icon" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="筛选专题关键词…"
            aria-label="筛选专题"
          />
        </div>
        <span className="study-browser-count">
          {filtered.length} / {topics.length} 个专题
        </span>
      </div>

      {isPending ? (
        <p className="muted">正在加载专题…</p>
      ) : filtered.length > 0 ? (
        <div className="study-grid study-all-grid">
          {filtered.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>没有匹配的专题。</p>
        </div>
      )}
    </div>
  )
}
