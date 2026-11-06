import { Link } from 'react-router-dom'

import { QuestionCard } from '../components/QuestionCard'
import { ReviewDone } from '../components/ReviewDone'
import { ReviewTop } from '../components/ReviewTop'
import { useReviewSession } from '../useReviewSession'

export default function ReviewPage() {
  const session = useReviewSession()
  const { phase, card, stats } = session

  if (phase === 'error') {
    const offline = [0, 502, 503, 504].includes(session.errorStatus)
    return (
      <div className="focus-main review-page">
        <div className="review-panel review-error">
          <h1>{offline ? '连不上学习服务' : '这次操作没成功'}</h1>
          <p>{session.error}</p>
          {offline ? (
            <p className="review-hint">
              在仓库根目录执行 <code>python anki-svc/import.py</code> 初始化复习数据，或执行
              <code>python scripts/dev.py</code> 启动服务后刷新本页。
            </p>
          ) : (
            <p className="review-hint">数据没有丢，重新取卡就能继续。</p>
          )}
          <div className="review-error-actions">
            <button type="button" className="review-btn" onClick={session.retry}>
              重试
            </button>
            <Link to="/study" className="review-btn ghost">返回学习</Link>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="focus-main review-page">
        <ReviewDone
          reviewed={session.reviewed}
          elapsedMs={session.elapsedMs}
          stats={stats}
          counts={session.counts}
          dueTotal={session.dueTotal}
          topics={session.topics}
          onContinue={session.continueRound}
        />
      </div>
    )
  }

  const waiting = phase === 'loading' || !card

  return (
    <div className="focus-main review-page">
      <ReviewTop
        loaded={phase !== 'loading' || card !== null}
        counts={session.counts}
        backlog={session.dueTotal}
        streak={stats?.streak ?? 0}
        newDone={stats?.todayNew ?? null}
        newLimit={stats?.newPerDay ?? 0}
        revDone={stats?.todayReview ?? null}
        revLimit={stats?.revPerDay ?? 0}
        reviewed={session.reviewed}
        busy={session.busy}
        onEnd={session.endSession}
      />

      {waiting ? (
        <div className="review-panel review-loading">
          <p>{session.stuck ? '取卡有点慢，可能服务刚启动。' : '正在取卡…'}</p>
          {session.stuck && (
            <button type="button" className="review-btn" onClick={session.retry}>
              重新取卡
            </button>
          )}
        </div>
      ) : (
        <QuestionCard
          card={card}
          phase={phase}
          answerHtml={session.answerHtml}
          revealing={session.revealing}
          canUndo={session.canUndo}
          busy={session.busy}
          onReveal={() => void session.reveal()}
          onUndo={() => void session.undo()}
          onRate={(rating) => void session.rate(rating)}
        />
      )}

      {(phase === 'question' || phase === 'answer') && (
        <p className="review-shortcuts">空格 显示答案 · 1–4 评分 · U 撤销 · Esc 结束本轮</p>
      )}

      {session.toast && (
        <div className="review-toast" role="status">
          {session.toast}
        </div>
      )}
    </div>
  )
}
