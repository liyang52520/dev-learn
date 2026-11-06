import { Link } from 'react-router-dom'

import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon } from '@/shared/components/Icons'
import { HtmlContent } from '@/shared/components/HtmlContent'
import type { QuestionDetail } from '@/types/models'

export function QuestionContent({ question }: { question: QuestionDetail }) {
  const topic = question.topic
  return (
    <main className="study-main">
      <header className="study-question-head">
        <div className="study-crumb">
          <Link to="/study">学习</Link>
          <ChevronRightIcon className="icon" />
          <Link to={`/study/${encodeURIComponent(topic.id)}`}>{topic.label}</Link>
          <ChevronRightIcon className="icon" />
          <span>{topic.no}</span>
          <Link to="/review" className="study-crumb-review">
            复习模式 ↗
          </Link>
        </div>
        <div className="study-question-kicker">
          <span style={{ background: topic.accent }} />
          第 {question.no} 题 · {question.pages}
        </div>
        <h1>{question.title}</h1>
        {question.aliases.length > 0 && (
          <div className="question-aliases">
            <span>同义题面</span>
            {question.aliases.map((alias) => (
              <em key={alias}>{alias}</em>
            ))}
          </div>
        )}
      </header>

      {question.summary.length > 0 && (
        <section className="summary-card">
          <div className="summary-head">
            <span>要点提炼</span>
            <em>SUMMARY</em>
          </div>
          <ul>
            {question.summary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      {question.note && <div className="question-note">原文备注：{question.note}</div>}

      <HtmlContent html={question.answer} className="prose study-answer" />

      <nav className="question-pager" aria-label="题目切换">
        {question.prev ? (
          <Link
            to={`/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(question.prev.id)}`}
            className="pager-link prev"
          >
            <small>
              <ArrowLeftIcon className="icon" /> 上一题
            </small>
            <strong>{question.prev.title}</strong>
          </Link>
        ) : (
          <span />
        )}
        {question.next ? (
          <Link
            to={`/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(question.next.id)}`}
            className="pager-link next"
          >
            <small>
              下一题 <ArrowRightIcon className="icon" />
            </small>
            <strong>{question.next.title}</strong>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  )
}
