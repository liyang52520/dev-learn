import { Link } from 'react-router-dom'

import { ApiError } from '@/shared/api/client'

import { toReviewPhase } from '../../review/types'
import { useReviewLauncher } from '../hooks'

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]']

/** 学习首页的复习入口：今日额度、总进度与最近答错。 */
export function ReviewLauncher() {
  const { data, isPending, error } = useReviewLauncher()

  // 加载态保留和成功态同高的骨架，避免 stats 回来时把整页顶下去。
  if (isPending) {
    return (
      <div className="review-launcher is-loading" aria-busy="true" aria-live="polite">
        <div className="review-launcher-text">
          <span className="review-launcher-skel skel-eyebrow" />
          <span className="review-launcher-skel skel-title" />
          <span className="review-launcher-skel skel-line" />
          <span className="review-launcher-skel skel-track" />
          <span className="review-launcher-skel skel-track" />
          <span className="review-launcher-skel skel-line" />
          <span className="review-launcher-skel skel-track" />
        </div>
        <span className="review-launcher-btn is-skeleton" aria-hidden>
          &nbsp;
        </span>
      </div>
    )
  }

  // 后端没起来时，公网读者看到空白即可；本机给一句明确提示，别像功能被删了。
  if (!data) {
    if (!LOCAL_HOSTS.includes(window.location.hostname)) return null
    const syncing = error instanceof ApiError && error.code === 'sync_in_progress'
    const detail = syncing
      ? '同步完成后刷新页面就能继续。'
      : '可能是本地 Anki 调度没有响应或后端尚未启动，稍后刷新页面再试。'
    return (
      <div className="review-launcher review-launcher-off">
        <div className="review-launcher-text">
          <strong>{syncing ? '数据正在同步' : '复习统计暂时不可用'}</strong>
          <span>{detail}</span>
        </div>
        <Link to="/review" className="review-launcher-btn ghost">去看看</Link>
      </div>
    )
  }

  const { stats, lapses } = data
  const due = stats.counts.new + stats.counts.learning + stats.counts.review
  const newPct =
    stats.newPerDay > 0
      ? Math.min(100, Math.round((stats.todayNew / stats.newPerDay) * 100))
      : 0
  const revPct =
    stats.revPerDay > 0
      ? Math.min(100, Math.round((stats.todayReview / stats.revPerDay) * 100))
      : 0
  const phase = toReviewPhase(stats.phase) ?? 'review'
  const quotaDone = phase === 'new_quota'
  // dueTotal 含「学习中」的卡，而 counts.review 只算复习卡；
  // 队列今天真正排得到的是 learning + review，别拿错基数吓人。
  const queuedDue = stats.counts.learning + stats.counts.review
  const overflow = Math.max(0, stats.dueTotal - queuedDue)
  const reviewLimitHit = phase === 'review_quota'
  const paused = phase === 'paused'

  const headline =
    phase === 'review'
      ? `今日可学 ${due} 张`
      : reviewLimitHit
        ? '今日复习额度用完了'
        : quotaDone
          ? '今日新卡额度用完了'
          : paused
            ? '复习已暂停'
            : '今天的卡清空了'

  const learnedPct =
    stats.totalCards > 0 ? Math.min(100, (stats.learnedCards / stats.totalCards) * 100) : 0
  // 几千张里只学了零星几张，显示 0% 会像没加载；给个「<1%」更诚实。
  const learnedLabel =
    learnedPct > 0 && learnedPct < 1 ? '<1%' : `${Math.round(learnedPct)}%`
  // aria-valuenow 不能超过 max：超额完成时按上限显示，避免读屏报出无效进度。
  const newMax = Math.max(stats.newPerDay, 1)
  const revMax = Math.max(stats.revPerDay, 1)
  const totalMax = Math.max(stats.totalCards, 1)

  return (
    <div className="review-launcher">
      <div className="review-launcher-text">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          SPACED REPETITION
        </p>
        <strong>{headline}</strong>
        <span>
          {stats.streak > 0 ? `连续 ${stats.streak} 天` : '今天还没复习'} · 累计作答{' '}
          {stats.totalAnswers} 次
        </span>
        {quotaDone && (
          <span className="review-launcher-note">
            还剩 {stats.newRemaining} 张新卡没学，明天额度刷新后继续。
          </span>
        )}
        {reviewLimitHit && (
          <span className="review-launcher-note">
            {overflow > 0
              ? `还有 ${overflow} 张到期卡超出今日复习限额（${stats.revPerDay}/天），明天继续。`
              : `今天复习额度已满，新卡也会一起停发（还剩 ${stats.newRemaining} 张没学），明天继续。`}
          </span>
        )}
        {paused && (
          <span className="review-launcher-note">
            新卡或复习额度被设为 0，去设置里调整后继续。
          </span>
        )}

        <span className="review-launcher-meter">
          <span className="review-launcher-meter-label">
            {stats.newPerDay > 0 ? `新卡 ${stats.todayNew}/${stats.newPerDay}` : `新卡 ${stats.todayNew}（已暂停）`}
          </span>
          <span
            className="review-launcher-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={newMax}
            aria-valuenow={Math.min(stats.todayNew, newMax)}
            aria-label={stats.newPerDay > 0 ? `今日新卡 ${stats.todayNew} / ${stats.newPerDay}` : `今日新卡 ${stats.todayNew}，已暂停`}
          >
            <span className="review-launcher-fill" style={{ width: `${newPct}%` }} />
          </span>
        </span>
        <span className="review-launcher-meter">
          <span className="review-launcher-meter-label">
            {stats.revPerDay > 0 ? `复习 ${stats.todayReview}/${stats.revPerDay}` : `复习 ${stats.todayReview}（已暂停）`}
          </span>
          <span
            className="review-launcher-track is-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={revMax}
            aria-valuenow={Math.min(stats.todayReview, revMax)}
            aria-label={stats.revPerDay > 0 ? `今日复习 ${stats.todayReview} / ${stats.revPerDay}` : `今日复习 ${stats.todayReview}，已暂停`}
          >
            <span className="review-launcher-fill is-soft" style={{ width: `${revPct}%` }} />
          </span>
        </span>

        <span className="review-launcher-overall">
          <span className="review-launcher-overall-head">
            总进度 <strong>{stats.learnedCards}</strong>/{stats.totalCards}
            <span className="review-launcher-overall-pct">{learnedLabel}</span>
          </span>
          <span
            className="review-launcher-track is-overall"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalMax}
            aria-valuenow={Math.min(stats.learnedCards, totalMax)}
            aria-label={`总进度 ${stats.learnedCards} / ${stats.totalCards}`}
          >
            <span className="review-launcher-fill is-overall" style={{ width: `${learnedPct}%` }} />
          </span>
          <span className="review-launcher-overall-note">
            全库未学 {stats.newRemaining} · 明天到期 {stats.dueTomorrow}
          </span>
        </span>

        {lapses.length > 0 && (
          <span className="review-lapses">
            <span className="review-lapses-label">最近答错</span>
            {lapses.slice(0, 4).map((item) => (
              <Link
                key={item.cardId}
                to={`/study/${encodeURIComponent(item.topicId)}/${encodeURIComponent(item.questionId)}`}
                className="review-lapse-link"
                title={item.topic}
              >
                {item.title}
              </Link>
            ))}
          </span>
        )}
      </div>
      <Link to="/review" className="review-launcher-btn">
        {due > 0 ? '开始复习' : '查看状态'}
        <span aria-hidden>→</span>
      </Link>
    </div>
  )
}
