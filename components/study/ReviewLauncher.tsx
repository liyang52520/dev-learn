'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import type { ReviewLapse, ReviewStats } from '@/components/review/types';

/**
 * 学习首页的复习入口。
 *
 * 服务没运行时：部署在公网（读者看不到本地服务）就整块不渲染；
 * 只有在本机访问时才给一句提示，免得「服务挂了」和「功能被删了」看起来一样。
 */
export default function ReviewLauncher() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [lapses, setLapses] = useState<ReviewLapse[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'down'>('loading');
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname));
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(withBasePath('/api/review/stats'), { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      fetch(withBasePath('/api/review/lapses'), { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
    ]).then(([statsData, lapseData]) => {
      if (!alive) return;
      if (statsData && statsData.ok) {
        setStats(statsData as ReviewStats);
        setState('ok');
      } else {
        setState('down');
      }
      if (lapseData && lapseData.ok && Array.isArray(lapseData.items)) {
        setLapses(lapseData.items as ReviewLapse[]);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // 加载态保留和成功态同高的骨架，避免 stats 回来时把整页顶下去 145px。
  if (state === 'loading') {
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
    );
  }

  if (!stats) {
    if (!isLocal) return null;
    return (
      <div className="review-launcher review-launcher-off">
        <div className="review-launcher-text">
          <strong>复习服务未启动</strong>
          <span>
            在仓库根目录执行 <code>npm run anki</code>，刷新后这里会出现今日待复习。
          </span>
        </div>
        <Link href="/review" className="review-launcher-btn ghost">
          去看看
        </Link>
      </div>
    );
  }

  const due = stats.counts.new + stats.counts.learning + stats.counts.review;
  const backlog = stats.due_total;
  const newPct = stats.new_per_day > 0
    ? Math.min(100, Math.round((stats.today_new / stats.new_per_day) * 100))
    : 0;
  const revPct = stats.rev_per_day > 0
    ? Math.min(100, Math.round((stats.today_review / stats.rev_per_day) * 100))
    : 0;
  const quotaDone = stats.new_per_day > 0
    && stats.today_new >= stats.new_per_day
    && stats.new_remaining > 0;
  // due_total 含「学习中」的卡，而 counts.review 只算复习卡；
  // 队列今天真正排得到的是 learning + review，别拿错基数吓人。
  const queuedDue = stats.counts.learning + stats.counts.review;
  const overflow = Math.max(0, backlog - queuedDue);
  const reviewLimitHit = stats.rev_per_day > 0
    && stats.today_review >= stats.rev_per_day
    && overflow > 0;
  // due_total 与队列计数不等，也可能是「学习中」的卡还没到点，别一律说成限额。
  const reviewBlocked = overflow > 0 && (reviewLimitHit || stats.rev_per_day === 0);

  const headline = due > 0
    ? `今日可学 ${due} 张`
    : reviewLimitHit
      ? '今日复习额度用完了'
      : quotaDone
        ? '今日新卡额度用完了'
        : '今天的卡清空了';

  // 站点和复习服务是分开启动的，旧版服务可能没有这两个字段；
  // 缺失时按 0 处理，否则会渲染出 NaN% 和一条无效宽度的满格进度条。
  const learnedCards = stats.learned_cards ?? 0;
  const dueTomorrow = stats.due_tomorrow ?? 0;
  const learnedPct = stats.total_cards > 0
    ? Math.min(100, (learnedCards / stats.total_cards) * 100)
    : 0;
  // 2521 张里只学了 8 张，显示 0% 会像没加载；给个「<1%」更诚实
  const learnedLabel = learnedPct > 0 && learnedPct < 1 ? '<1%' : `${Math.round(learnedPct)}%`;

  return (
    <div className="review-launcher">
      <div className="review-launcher-text">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          SPACED REPETITION
        </p>
        <strong>{headline}</strong>
        <span>
          连续 {stats.streak} 天
          {' · '}累计 {stats.total_reviews} 次
        </span>
        {quotaDone && (
          <span className="review-launcher-note">
            还剩 {stats.new_remaining} 张新卡没学，明天额度刷新后继续。
          </span>
        )}
        {reviewBlocked && (
          <span className="review-launcher-note">
            还有 {overflow} 张到期卡
            {stats.rev_per_day > 0 ? `超出今日复习限额（${stats.rev_per_day}/天），明天继续。` : '，复习已暂停，去设置里恢复额度。'}
          </span>
        )}
        <span className="review-launcher-meter">
          <span className="review-launcher-meter-label">
            新卡 {stats.today_new}/{stats.new_per_day}
          </span>
          <span
            className="review-launcher-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={stats.new_per_day || 0}
            aria-valuenow={stats.today_new}
            aria-label={`今日新卡 ${stats.today_new} / ${stats.new_per_day}`}
          >
            <span className="review-launcher-fill" style={{ width: `${newPct}%` }} />
          </span>
        </span>
        <span className="review-launcher-meter">
          <span className="review-launcher-meter-label">
            复习 {stats.today_review}/{stats.rev_per_day}
          </span>
          <span
            className="review-launcher-track is-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={stats.rev_per_day || 0}
            aria-valuenow={stats.today_review}
            aria-label={`今日复习 ${stats.today_review} / ${stats.rev_per_day}`}
          >
            <span className="review-launcher-fill is-soft" style={{ width: `${revPct}%` }} />
          </span>
        </span>

        <span className="review-launcher-overall">
          <span className="review-launcher-overall-head">
            总进度 <strong>{learnedCards}</strong>/{stats.total_cards}
            <span className="review-launcher-overall-pct">{learnedLabel}</span>
          </span>
          <span
            className="review-launcher-track is-overall"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={stats.total_cards || 0}
            aria-valuenow={learnedCards}
            aria-label={`总进度 ${learnedCards} / ${stats.total_cards}`}
          >
            <span className="review-launcher-fill is-overall" style={{ width: `${learnedPct}%` }} />
          </span>
          <span className="review-launcher-overall-note">
            剩余新卡 {stats.new_remaining} · 明日到期 {dueTomorrow}
          </span>
        </span>

        {lapses.length > 0 && (
          <span className="review-lapses">
            <span className="review-lapses-label">最近答错</span>
            {lapses.slice(0, 4).map((item) => (
              <Link
                key={item.card_id}
                href={`/study/${encodeURIComponent(item.topicId)}/${encodeURIComponent(item.questionId)}`}
                className="review-lapse-link"
                title={item.topic}
              >
                {item.title}
              </Link>
            ))}
          </span>
        )}
      </div>
      <Link href="/review" className="review-launcher-btn">
        {due > 0 ? '开始复习' : '查看状态'}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
