'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import Heatmap from './Heatmap';
import type { ApiResult, ReviewCard, ReviewCounts, ReviewStats } from './types';

type Phase = 'loading' | 'question' | 'answer' | 'done' | 'error';

const RATING_HINTS: Record<number, string> = { 1: '忘记', 2: '模糊', 3: '记得', 4: '简单' };
const STATE_LABEL: Record<string, string> = {
  new: '新卡',
  learning: '学习中',
  review: '复习',
  relearning: '重学',
  unknown: '未知',
};
const SESSION_KEY = 'yg-review-session';

interface StoredSession {
  date: string;
  reviewed: number;
  elapsedMs: number;
  topics: string[];
}

interface AnswerResponse {
  counts: ReviewCounts;
  next: ReviewCard | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(withBasePath(path), { cache: 'no-store', ...init });
  const data = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!res.ok || !data || !data.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.date === todayIso() ? parsed : null;
  } catch {
    return null;
  }
}

export default function ReviewSession() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<ReviewCard | null>(null);
  const [counts, setCounts] = useState<ReviewCounts>({ new: 0, learning: 0, review: 0 });
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [ratedThisTab, setRatedThisTab] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [topics, setTopics] = useState<string[]>([]);
  const [stuck, setStuck] = useState(false);

  const mounted = useRef(true);
  const elapsedRef = useRef(0);
  const segmentRef = useRef<number | null>(null);
  const undoQueued = useRef(false);

  // 4 秒还没卡出来，给一个可以自救的按钮
  useEffect(() => {
    if (phase !== 'loading') {
      setStuck(false);
      return;
    }
    const timer = window.setTimeout(() => setStuck(true), 4000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const stored = readSession();
    if (!stored) return;
    setReviewed(stored.reviewed);
    setTopics(stored.topics || []);
    elapsedRef.current = stored.elapsedMs || 0;
    setElapsedMs(stored.elapsedMs || 0);
  }, []);

  useEffect(() => {
    if (reviewed <= 0) return;
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ date: todayIso(), reviewed, elapsedMs, topics } satisfies StoredSession),
      );
    } catch {
      /* 隐私模式写不了，忽略 */
    }
  }, [reviewed, elapsedMs, topics]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadStats = useCallback(async () => {
    try {
      const data = await api<ReviewStats>('/api/review/stats');
      if (mounted.current) setStats(data);
    } catch {
      /* 统计拿不到不影响复习 */
    }
  }, []);

  /** 把当前这段「停留时间」累加进本轮用时 */
  const flushSegment = useCallback(() => {
    if (segmentRef.current !== null) {
      elapsedRef.current += Date.now() - segmentRef.current;
      segmentRef.current = Date.now();
    }
    return elapsedRef.current;
  }, []);

  const finish = useCallback(() => {
    const spent = flushSegment();
    setElapsedMs(spent);
    setCard(null);
    setPhase('done');
    void loadStats();
  }, [flushSegment, loadStats]);

  const loadNext = useCallback(async () => {
    setBusy(true);
    try {
      const data = await api<{ cards: ReviewCard[]; counts: ReviewCounts }>('/api/review/queue?limit=1');
      if (!mounted.current) return;
      setCounts(data.counts);
      if (!data.cards.length) {
        finish();
      } else {
        if (segmentRef.current === null) segmentRef.current = Date.now();
        setCard(data.cards[0]);
        setPhase('question');
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : '取卡失败');
      setPhase('error');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [finish]);

  // 进入页面就拉一次：Strict Mode 下 effect 会跑两遍，第二遍必须重新置为 true 并发请求，
  // 否则第一次的响应会被 cleanup 之后的判断丢掉，页面永远停在「正在取卡…」。
  useEffect(() => {
    mounted.current = true;
    void loadNext();
    void loadStats();
    return () => {
      mounted.current = false;
    };
  }, [loadNext, loadStats]);

  const reveal = useCallback(() => {
    setPhase((current) => (current === 'question' ? 'answer' : current));
  }, []);

  const rate = useCallback(
    async (rating: number) => {
      if (!card || busy) return;
      setBusy(true);
      try {
        // /answer 直接带回下一张卡，省掉一次 queue 往返
        const data = await api<AnswerResponse>('/api/review/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: card.card_id, rating }),
        });
        if (!mounted.current) return;
        setReviewed((n) => n + 1);
        setRatedThisTab((n) => n + 1);
        const topic = card.question?.topic;
        if (topic) setTopics((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
        flushSegment();
        setCounts(data.counts);
        if (!data.next) {
          finish();
        } else {
          setCard(data.next);
          setPhase('question');
        }
        // 统计不阻塞翻卡，后台刷新即可
        void loadStats();
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof Error ? err.message : '评分失败');
        setPhase('error');
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [card, busy, finish, flushSegment, loadStats],
  );

  const undo = useCallback(async () => {
    if (busy) {
      // 手快时不要吞掉撤销，等这一轮忙完再执行
      undoQueued.current = true;
      return;
    }
    setBusy(true);
    try {
      await api('/api/review/undo', { method: 'POST' });
      if (!mounted.current) return;
      setReviewed((n) => Math.max(0, n - 1));
      setRatedThisTab((n) => Math.max(0, n - 1));
      setToast('已撤销上一张');
      await loadNext();
      void loadStats();
    } catch (err) {
      if (mounted.current) {
        setToast(err instanceof Error ? err.message : '没有可撤销的操作');
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, loadNext, loadStats]);

  useEffect(() => {
    if (busy || !undoQueued.current) return;
    undoQueued.current = false;
    void undo();
  }, [busy, undo]);

  const endSession = useCallback(() => {
    finish();
  }, [finish]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // 带修饰键的一律不抢：Cmd+1 是切标签页，不是「忘记」
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const onInteractive = Boolean(target && typeof target.closest === 'function'
        && target.closest('a, button, [role="button"]'));

      if (event.key === 'Escape') {
        if (reviewed > 0) {
          event.preventDefault();
          endSession();
        }
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        if (onInteractive) return; // 焦点在按钮/链接上时交给浏览器
        if (phase === 'question') {
          event.preventDefault();
          reveal();
        }
        return;
      }
      if (busy && event.key.toLowerCase() !== 'u') return;
      if (phase === 'answer' && ['1', '2', '3', '4'].includes(event.key)) {
        event.preventDefault();
        void rate(Number(event.key));
        return;
      }
      if ((phase === 'question' || phase === 'answer') && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        void undo();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, busy, reveal, rate, undo, endSession, reviewed]);

  const loaded = phase !== 'loading' || card !== null;
  const remaining = counts.new + counts.learning + counts.review;
  const canUndo = ratedThisTab > 0;
  const newLimit = stats?.new_per_day ?? 0;
  const revLimit = stats?.rev_per_day ?? 0;
  const newDone = stats?.today_new ?? null;
  const revDone = stats?.today_review ?? null;
  const newPct = newLimit > 0 && newDone !== null ? Math.min(100, Math.round((newDone / newLimit) * 100)) : 0;
  const revPct = revLimit > 0 && revDone !== null ? Math.min(100, Math.round((revDone / revLimit) * 100)) : 0;

  if (phase === 'error') {
    return (
      <div className="review-page">
        <div className="review-panel review-error">
          <h1>连不上学习服务</h1>
          <p>{error}</p>
          <p className="review-hint">在仓库根目录执行 <code>npm run anki</code> 后刷新本页。</p>
          <div className="review-error-actions">
            <button
              type="button"
              className="review-btn"
              onClick={() => { setError(''); setPhase('loading'); void loadNext(); }}
            >
              重试
            </button>
            <Link href="/study" className="review-btn ghost">返回学习</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const seconds = Math.round(elapsedMs / 1000);
    const duration = seconds < 60 ? `${Math.max(1, seconds)} 秒` : `${Math.round(seconds / 60)} 分钟`;
    const perCard = reviewed > 0 ? Math.max(1, Math.round(seconds / reviewed)) : 0;
    const nextDue = stats?.next_due_epoch ? formatNextDue(stats.next_due_epoch) : null;
    const finishedAll = remaining === 0;
    const hitNewLimit = Boolean(
      stats && stats.new_per_day > 0 && stats.today_new >= stats.new_per_day && stats.new_remaining > 0,
    );
    const title = reviewed > 0
      ? (finishedAll ? (hitNewLimit ? '今天的额度用完了' : '今天的复习完成了') : '这一轮结束了')
      : (finishedAll ? '现在没有到期的卡' : '还没有开始');

    return (
      <div className="review-page">
        <div className="review-panel review-done">
          <div className="review-done-mark" aria-hidden>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5 9.5 18 20 6.5" />
            </svg>
          </div>
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1>{title}</h1>
          <p className="review-done-sub">
            {reviewed > 0
              ? `用时 ${duration}${perCard > 0 ? `，平均每张 ${perCard} 秒` : ''}。`
              : finishedAll
                ? '下一批到期后，从学习首页点「开始复习」就行。'
                : '点下面的按钮继续，或者回到学习首页。'}
          </p>

          {reviewed > 0 && (
            <div className="review-done-count" aria-label={`本轮复习 ${reviewed} 张`}>
              <span className="review-done-count-label">本轮完成</span>
              <span className="review-done-count-num">
                <strong>{reviewed}</strong>
                <span>张</span>
              </span>
            </div>
          )}

          <div className="review-done-stats">
            <span><strong>{stats?.today ?? '—'}</strong>今日卡片</span>
            <span><strong>{stats?.streak ?? '—'}</strong>连续天数</span>
            <span><strong>{stats?.total_reviews ?? '—'}</strong>累计复习</span>
          </div>

          {stats && (
            <p className="review-done-quota">
              今日 新卡 {stats.today_new}/{stats.new_per_day} · 复习 {stats.today_review}/{stats.rev_per_day}
              {stats.new_remaining > 0 ? ` · 还有 ${stats.new_remaining} 张新卡没学` : ''}
            </p>
          )}

          {topics.length > 0 && (
            <p className="review-done-topics">
              覆盖 {topics.length} 个专题：{topics.slice(0, 5).join(' · ')}
              {topics.length > 5 ? ' 等' : ''}
            </p>
          )}

          {nextDue && (
            <p className="review-done-next">
              <span className="review-done-next-dot" aria-hidden />
              下一张卡：{nextDue}
            </p>
          )}

          {stats && stats.days.length > 2 && <Heatmap days={stats.days} />}

          <div className="review-done-actions">
            {remaining > 0 ? (
              <button type="button" className="review-btn" onClick={() => void loadNext()}>
                继续复习 · 还剩 {remaining} 张
              </button>
            ) : (
              <button type="button" className="review-btn" onClick={() => void loadNext()}>
                再检查一次
              </button>
            )}
            <Link href="/study" className="review-btn ghost">回到学习</Link>
          </div>

          {hitNewLimit && (
            <p className="review-done-help">
              新卡额度打满不代表都学会了，剩下的 {stats?.new_remaining} 张明天继续。
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="review-page">
      <header className="review-top">
        <Link href="/study" className="review-back" aria-label="返回学习">←</Link>

        <div className="review-head">
          <div className="review-progress">
            <span className="review-progress-item">
              <span
                className="review-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={newLimit || 0}
                aria-valuenow={newDone ?? 0}
                aria-label={`今日新卡 ${newDone ?? 0} / ${newLimit}`}
              >
                <span className="review-progress-fill" style={{ width: `${newPct}%` }} />
              </span>
              <span className="review-progress-label">
                今日新卡 <strong>{newDone ?? '—'}</strong>/{newLimit || '—'}
              </span>
            </span>
            <span className="review-progress-item">
              <span
                className="review-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={revLimit || 0}
                aria-valuenow={revDone ?? 0}
                aria-label={`今日复习 ${revDone ?? 0} / ${revLimit}`}
              >
                <span className="review-progress-fill review-progress-fill-soft" style={{ width: `${revPct}%` }} />
              </span>
              <span className="review-progress-label">
                今日复习 <strong>{revDone ?? '—'}</strong>/{revLimit || '—'}
              </span>
            </span>
          </div>
          <div className="review-chips">
            <span>待发新卡 <strong>{loaded ? counts.new : '—'}</strong></span>
            <span>学习中 <strong>{loaded ? counts.learning : '—'}</strong></span>
            <span>到期复习 <strong>{loaded ? counts.review : '—'}</strong></span>
            <span>连续 <strong>{stats?.streak ?? '—'}</strong> 天</span>
          </div>
        </div>

        <button
          type="button"
          className="review-end"
          onClick={endSession}
          disabled={reviewed === 0}
          title="不要求清空队列，随时可以结束看小结（Esc）"
        >
          结束本轮
        </button>
      </header>

      {phase === 'loading' || !card ? (
        <div className="review-panel review-loading">
          <p>{stuck ? '取卡有点慢，可能服务刚启动。' : '正在取卡…'}</p>
          {stuck && (
            <button type="button" className="review-btn" onClick={() => void loadNext()}>
              重新取卡
            </button>
          )}
        </div>
      ) : (
        <div className="review-panel" aria-live="polite" aria-busy={busy}>
          <div className="review-meta">
            <span>{card.question?.topic || card.qid}</span>
            {card.question?.pages && <span>{card.question.pages}</span>}
            <span className="review-state">{STATE_LABEL[card.state] || card.state}</span>
          </div>

          <h1 className="review-question">{card.question?.title || '（题目内容缺失）'}</h1>
          {card.question?.aliases && card.question.aliases.length > 0 && (
            <p className="review-alias">别名：{card.question.aliases.join('；')}</p>
          )}

          {phase === 'question' ? (
            <>
              <button type="button" className="review-reveal" onClick={reveal}>
                显示答案
                <kbd>空格</kbd>
              </button>
              <div className="review-undo-row">
                <button
                  type="button"
                  className="review-undo"
                  onClick={() => void undo()}
                  disabled={!canUndo}
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
              <div
                className="prose study-answer review-answer"
                // 内容来自本仓库 data/study 的原文 HTML，与题目页共用同一套渲染与高亮
                dangerouslySetInnerHTML={{ __html: card.question?.answerHtml || '' }}
              />

              <div className="review-bottom">
                <button
                  type="button"
                  className="review-undo-icon"
                  onClick={() => void undo()}
                  disabled={!canUndo}
                  title="撤销上一张 (U)"
                  aria-label="撤销上一张"
                >
                  ↩
                </button>
                <div className="review-actions">
                  {card.labels.map((label, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`review-rate rate-${index + 1}`}
                      disabled={busy}
                      onClick={() => void rate(index + 1)}
                      title={`${RATING_HINTS[index + 1]} · 下次 ${label}`}
                      aria-label={`${RATING_HINTS[index + 1]}，下次 ${label}`}
                    >
                      <span className="rate-label">{label}</span>
                      <span className="rate-hint">{RATING_HINTS[index + 1]}</span>
                      <span className="rate-key">{index + 1}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {toast && <div className="review-toast">{toast}</div>}
    </div>
  );
}

function formatNextDue(epochSeconds: number): string {
  const due = new Date(epochSeconds * 1000);
  const now = new Date();
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (due.getTime() < now.getTime() - 60_000) return '已到期';
  const days = Math.round((dayStart(due) - dayStart(now)) / 86_400_000);
  const hm = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
  if (days <= 0) return `今天 ${hm}`;
  if (days === 1) return '明天';
  if (days === 2) return '后天';
  return `${due.getMonth() + 1} 月 ${due.getDate()} 日`;
}
