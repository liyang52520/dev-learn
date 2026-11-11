import { Link } from 'react-router-dom'

import { HtmlContent } from '@/shared/components/HtmlContent'
import type { ReviewCard } from '@/types/models'

import { RatingBar } from './RatingBar'
import { STATE_LABELS, type CardAction, type Phase } from '../types'

type Props = {
  card: ReviewCard
  phase: Phase
  answerHtml: string
  revealing: boolean
  canUndo: boolean
  busy: boolean
  onReveal: () => void
  onUndo: () => void
  onCardAction: (action: CardAction) => void
  onRate: (rating: number) => void
}

function questionLinks(card: ReviewCard): { origin: string; edit: string } | null {
  const topicId = card.question?.topicId
  if (!topicId) return null
  const questionId = card.qid.split('/').slice(1).join('/')
  if (!questionId) return null
  const encodedTopic = encodeURIComponent(topicId)
  const encodedQuestion = encodeURIComponent(questionId)
  return {
    origin: `/study/${encodedTopic}/${encodedQuestion}`,
    edit: `/admin/study?tab=bank&topic=${encodedTopic}&qid=${encodedQuestion}`,
  }
}

export function QuestionCard(props: Props) {
  const { card, phase, answerHtml, revealing, canUndo, busy } = props
  const links = questionLinks(card)
  const waiting = phase === 'loading' || !card

  return (
    <div className={`review-panel${phase === 'question' ? ' is-question' : ''}`} aria-busy={busy}>
      <div className="review-meta">
        <span>{card.question?.topic || card.qid}</span>
        {card.question?.pages && <span>{card.question.pages}</span>}
        {links && (
          <>
            <Link className="review-origin" to={links.origin} target="_blank" rel="noreferrer">
              查看原文 ↗
            </Link>
            <Link
              className="quick-edit"
              to={links.edit}
              target="_blank"
              rel="noreferrer"
              title="在新标签页打开题库后台编辑这道题"
            >
              编辑
            </Link>
          </>
        )}
        <span className="review-state">{STATE_LABELS[card.state] || card.state}</span>
      </div>

      <h1 className="review-question">{card.question?.title || '（题目内容缺失）'}</h1>
      {card.question?.aliases && card.question.aliases.length > 0 && (
        <p className="review-alias">别名：{card.question.aliases.join('；')}</p>
      )}

      {waiting ? null : phase === 'question' ? (
        <>
          <div className="review-tools" role="group" aria-label="卡片操作">
            <button type="button" onClick={() => props.onCardAction('bury')} disabled={busy} title="今天不再出现 (B)">
              埋藏 <kbd>B</kbd>
            </button>
            <button type="button" onClick={() => props.onCardAction('suspend')} disabled={busy} title="暂停这张卡，直到在 Anki 里恢复 (S)">
              暂停 <kbd>S</kbd>
            </button>
            <button
              type="button"
              className={card.flag ? 'is-flagged' : ''}
              onClick={() => props.onCardAction('flag')}
              disabled={busy}
              title="标记这张卡，再按一次取消 (F)"
            >
              {card.flag ? '取消标记' : '标记'} <kbd>F</kbd>
            </button>
          </div>
          <button type="button" className="review-reveal" onClick={props.onReveal} disabled={busy || revealing}>
            {revealing ? '正在载入原文…' : '显示答案'}
            {!revealing && <kbd>空格</kbd>}
          </button>
          <div className="review-undo-row">
            <button
              type="button"
              className={`review-undo${canUndo ? '' : ' is-inactive'}`}
              onClick={props.onUndo}
              aria-disabled={!canUndo}
              title={canUndo ? '撤销最近一次评分' : '只能撤销本标签页最近 10 分钟内的评分'}
            >
              撤销上一张 <kbd>U</kbd>
            </button>
          </div>
        </>
      ) : (
        <>
          {card.question?.summary && card.question.summary.length > 0 && (
            <>
              <p className="review-section-title">要点</p>
              <ul className="review-points">
                {card.question.summary.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </>
          )}
          <p className="review-section-title">
            原文答案{card.question?.pages ? ` · ${card.question.pages}` : ''}
          </p>
          <HtmlContent className="prose study-answer review-answer" html={answerHtml} />

          <div className="review-bottom">
            <button
              type="button"
              className={`review-undo-icon${canUndo ? '' : ' is-inactive'}`}
              onClick={props.onUndo}
              aria-disabled={!canUndo}
              title={canUndo ? '撤销上一张 (U)' : '只能撤销本标签页最近 10 分钟内的评分'}
              aria-label="撤销上一张"
            >
              <span aria-hidden>↩</span>
              <span className="review-undo-text">撤销</span>
            </button>
            <RatingBar labels={card.labels} busy={busy} onRate={props.onRate} />
          </div>
        </>
      )}
    </div>
  )
}
