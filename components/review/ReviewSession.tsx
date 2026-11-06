'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import Heatmap from './Heatmap';
import type {
  ApiResult,
  ReviewCard,
  ReviewCounts,
  ReviewProgress,
  ReviewStats,
} from './types';

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
  /** 本标签页的评分栈：刷新后撤销仍然只回退自己评过的那一次 */
  stack?: RatedEntry[];
}

interface AnswerResponse {
  counts: ReviewCounts;
  due_total: number;
  progress?: ReviewProgress;
  next: ReviewCard | null;
}

interface RatedEntry {
  id: number;
  /** 这一次评分是否让「本轮已评」+1（同一张卡重复出现时只有第一次算） */
  counted: boolean;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(withBasePath(path), { cache: 'no-store', ...init });
  const data = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!res.ok || !data || !data.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  }
  return data;
}

function isStale(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409;
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

/** 复习卡 → 原文题目页。qid 形如「专题 id/题目 id」。 */
function originHrefOf(card: ReviewCard): string | null {
  const topicId = card.question?.topicId;
  if (!topicId) return null;
  const [, ...rest] = card.qid.split('/');
  const questionId = rest.join('/');
  if (!questionId) return null;
  return `/study/${encodeURIComponent(topicId)}/${encodeURIComponent(questionId)}`;
}

export default function ReviewSession() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<ReviewCard | null>(null);
  const [counts, setCounts] = useState<ReviewCounts>({ new: 0, learning: 0, review: 0 });
  const [dueTotal, setDueTotal] = useState(0);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(0);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [ratedThisTab, setRatedThisTab] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [topics, setTopics] = useState<string[]>([]);
  const [stuck, setStuck] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const mounted = useRef(true);
  const elapsedRef = useRef(0);
  const segmentRef = useRef<number | null>(null);
  const undoQueued = useRef(false);
  const ratedIds = useRef<Set<number>>(new Set());
  const ratedOrder = useRef<RatedEntry[]>([]);
  const lastStatsAt = useRef(0);

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
    const stack = stored.stack || [];
    ratedOrder.current = stack;
    ratedIds.current = new Set(stack.map((entry) => entry.id));
    elapsedRef.current = stored.elapsedMs || 0;
    setElapsedMs(stored.elapsedMs || 0);
  }, []);

  useEffect(() => {
    // 只在进行中的轮次写入：结束时 finish() 已经清掉了存储，
    // 若这里不判断 phase，setElapsedMs 会把刚删掉的记录又写回去。
    if (phase !== 'question' && phase !== 'answer') return;
    if (reviewed <= 0) {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* 忽略 */
      }
      return;
    }
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          date: todayIso(),
          reviewed,
          elapsedMs,
          topics,
          stack: ratedOrder.current,
        } satisfies StoredSession),
      );
    } catch {
      /* 隐私模式写不了，忽略 */
    }
  }, [reviewed, elapsedMs, topics, phase, ratedThisTab]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 切到后台时停止计时，回来再继续：否则「平均每张」会被挂机时间撑爆。
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        if (segmentRef.current !== null) {
          elapsedRef.current += Date.now() - segmentRef.current;
          segmentRef.current = null;
        }
      } else if (phase === 'question' || phase === 'answer') {
        segmentRef.current = Date.now();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [phase]);

  const loadStats = useCallback(async (force = false) => {
    const now = Date.now();
    // 每翻一张都打一次 stats 会把服务打满，4 秒节流；结束本轮时强制刷新。
    if (!force && now - lastStatsAt.current < 4000) return;
    lastStatsAt.current = now;
    try {
      const data = await api<ReviewStats>('/api/review/stats');
      if (mounted.current) setStats(data);
    } catch {
      /* 统计拿不到不影响复习 */
    }
  }, []);

  /** 作答后服务端会带回轻量进度，直接合并进 stats，顶部数字不再等 4 秒节流 */
  const applyProgress = useCallback((next?: ReviewProgress) => {
    if (!next) return;
    setStats((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  /** 把当前这段「停留时间」累加进本轮用时 */
  const flushSegment = useCallback(() => {
    if (segmentRef.current !== null) {
      elapsedRef.current += Date.now() - segmentRef.current;
      segmentRef.current = Date.now();
    }
    return elapsedRef.current;
  }, []);

  /** 开新一轮：本轮计数清零，但服务端的撤销栈不受影响 */
  const resetRound = useCallback(() => {
    setReviewed(0);
    setRatedThisTab(0);
    setTopics([]);
    ratedIds.current = new Set();
    ratedOrder.current = [];
    elapsedRef.current = 0;
    setElapsedMs(0);
    segmentRef.current = null;
  }, []);

  const finish = useCallback(() => {
    const spent = flushSegment();
    segmentRef.current = null;
    setElapsedMs(spent);
    setCard(null);
    setPhase('done');
    // 本轮已经结束，别再让下一次打开继承旧的「本轮完成」数字。
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* 忽略 */
    }
    void loadStats(true);
  }, [flushSegment, loadStats]);

  const loadNext = useCallback(
    async (retried = false) => {
      setBusy(true);
      try {
        const data = await api<{ cards: ReviewCard[]; counts: ReviewCounts; due_total: number }>(
          '/api/review/queue?limit=1',
        );
        if (!mounted.current) return;
        setCounts(data.counts);
        setDueTotal(data.due_total ?? 0);
        if (!data.cards.length) {
          finish();
        } else {
          if (segmentRef.current === null) segmentRef.current = Date.now();
          setCard(data.cards[0]);
          setPhase('question');
        }
      } catch (err) {
        if (!mounted.current) return;
        // 409 是卡片的调度状态过期（比如另一个标签页已经答过），不是服务挂了：
        // 自动重取一次，别把用户丢进「连不上服务」的错误页。
        if (isStale(err) && !retried) {
          setToast('这张卡的状态已更新，正在重新取卡');
          window.setTimeout(() => void loadNext(true), 250);
          return;
        }
        setErrorStatus(err instanceof ApiError ? err.status : 0);
        setError(err instanceof Error ? err.message : '取卡失败');
        setPhase('error');
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [finish],
  );

  // 进入页面就拉一次：Strict Mode 下 effect 会跑两遍，第二遍必须重新置为 true 并发请求，
  // 否则第一次的响应会被 cleanup 之后的判断丢掉，页面永远停在「正在取卡…」。
  useEffect(() => {
    mounted.current = true;
    void loadNext();
    void loadStats(true);
    return () => {
      mounted.current = false;
    };
  }, [loadNext, loadStats]);

  const reveal = useCallback(async () => {
    if (phase !== 'question' || revealing || !card) return;
    if (!card.question || card.question.answerHtml || card.question.hasAnswer === false) {
      setPhase('answer');
      return;
    }
    setRevealing(true);
    try {
      const data = await api<{ answerHtml: string }>(
        `/api/review/card-answer?qid=${encodeURIComponent(card.qid)}`,
      );
      if (!mounted.current) return;
      setCard((prev) => (prev && prev.question
        ? { ...prev, question: { ...prev.question, answerHtml: data.answerHtml } }
        : prev));
      setPhase('answer');
    } catch (err) {
      if (mounted.current) {
        setToast(err instanceof Error ? err.message : '原文加载失败，请重试');
      }
    } finally {
      if (mounted.current) setRevealing(false);
    }
  }, [phase, revealing, card]);

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
        // 「本轮完成」按卡片去重：学习步骤里同一张卡会出现多次，但用户只学了 1 张。
        // 同时记录每一次评分，撤销时才能准确回退计数。
        const counted = !ratedIds.current.has(card.card_id);
        if (counted) {
          ratedIds.current.add(card.card_id);
          setReviewed((n) => n + 1);
        }
        ratedOrder.current.push({ id: card.card_id, counted });
        setRatedThisTab((n) => n + 1);
        const topic = card.question?.topic;
        if (topic) setTopics((prev) => (prev.includes(topic) ? prev : [...prev, topic]));
        flushSegment();
        setCounts(data.counts);
        if (typeof data.due_total === 'number') setDueTotal(data.due_total);
        applyProgress(data.progress);
        if (!data.next) {
          finish();
        } else {
          setCard(data.next);
          setPhase('question');
        }
        // 统计不阻塞翻卡，后台刷新即可（内部节流）
        void loadStats();
      } catch (err) {
        if (!mounted.current) return;
        if (isStale(err)) {
          setToast('这张卡已被处理，正在取下一张');
          void loadNext(true);
          return;
        }
        setErrorStatus(err instanceof ApiError ? err.status : 0);
        setError(err instanceof Error ? err.message : '评分失败');
        setPhase('error');
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
    [card, busy, finish, flushSegment, loadNext, loadStats, applyProgress],
  );

  const undo = useCallback(async () => {
    if (busy) {
      // 手快时不要吞掉撤销，等这一轮忙完再执行
      undoQueued.current = true;
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ progress?: ReviewProgress }>('/api/review/undo', { method: 'POST' });
      if (!mounted.current) return;
      // 撤销栈是全局的（可能来自另一个标签页），只回退「本标签页确实评过」的那一次。
      const last = ratedOrder.current.pop();
      if (last) {
        if (last.counted) {
          ratedIds.current.delete(last.id);
          setReviewed((n) => Math.max(0, n - 1));
        }
        setRatedThisTab((n) => Math.max(0, n - 1));
      }
      applyProgress(data.progress);
      setToast(last ? '已撤销上一张' : '已撤销最近一次评分（来自其他标签页）');
      await loadNext(true);
      void loadStats(true);
    } catch (err) {
      if (mounted.current) {
        setToast(err instanceof Error ? err.message : '没有可撤销的操作');
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [busy, loadNext, loadStats, applyProgress]);

  useEffect(() => {
    if (busy || !undoQueued.current) return;
    undoQueued.current = false;
    void undo();
  }, [busy, undo]);

  const endSession = useCallback(() => {
    finish();
  }, [finish]);

  const continueRound = useCallback(() => {
    resetRound();
    setPhase('loading');
    setCard(null);
    void loadNext(false);
  }, [loadNext, resetRound]);

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
          void reveal();
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
  // 服务端的撤销栈跨刷新/跨标签页都在，不能只看本标签页评过几张。
  const canUndo = ratedThisTab > 0 || Boolean(stats?.can_undo);
  const newLimit = stats?.new_per_day ?? 0;
  const revLimit = stats?.rev_per_day ?? 0;
  const newDone = stats?.today_new ?? null;
  const revDone = stats?.today_review ?? null;
  const newPct = newLimit > 0 && newDone !== null ? Math.min(100, Math.round((newDone / newLimit) * 100)) : 0;
  const revPct = revLimit > 0 && revDone !== null ? Math.min(100, Math.round((revDone / revLimit) * 100)) : 0;
  // 以作答响应里的 due_total 为准：stats 可能有几秒滞后
  const backlog = dueTotal;
  const queueReview = counts.learning + counts.review;
  const overflow = Math.max(0, backlog - queueReview);
  const hitNewLimit = newLimit > 0 && newDone !== null && newDone >= newLimit && (stats?.new_remaining ?? 0) > 0;
  // 复习额度打满时 Anki 会连新卡一起停发，这两种情况都是「额度用完」
  const hitRevLimit = revLimit > 0 && revDone !== null && revDone >= revLimit && overflow > 0;
  const outOfQuota = hitNewLimit || hitRevLimit;

  if (phase === 'error') {
    // 只有真的连不上才提示去启动服务；409/500 是服务内部的业务错误，别让用户去跑命令。
    const offline = errorStatus === 0 || errorStatus === 502 || errorStatus === 503 || errorStatus === 504;
    return (
      <div className="review-page">
        <div className="review-panel review-error">
          <h1>{offline ? '连不上学习服务' : '这次操作没成功'}</h1>
          <p>{error}</p>
          {offline ? (
            <p className="review-hint">在仓库根目录执行 <code>npm run anki</code> 后刷新本页。</p>
          ) : (
            <p className="review-hint">数据没有丢，重新取卡就能继续。</p>
          )}
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
    const title = reviewed > 0
      ? (finishedAll ? (outOfQuota ? '今天的额度用完了' : '今天的复习完成了') : '这一轮结束了')
      : (finishedAll ? (outOfQuota ? '今天的额度用完了' : '现在没有到期的卡') : '还没有开始');

    return (
      <div className="review-page">
        <div className="review-panel review-done">
          <div className={`review-done-mark${finishedAll ? '' : ' is-paused'}`} aria-hidden>
            {finishedAll ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5 9.5 18 20 6.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
                <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
                <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
              </svg>
            )}
          </div>
          <p className="eyebrow">{finishedAll ? 'SESSION COMPLETE' : 'ROUND PAUSED'}</p>
          <h1>{title}</h1>
          <p className="review-done-sub">
            {reviewed > 0
              ? `用时 ${duration}${perCard > 0 ? `，平均每张 ${perCard} 秒` : ''}。`
              : finishedAll
                ? '下一批到期后，从学习首页点「开始复习」就行。'
                : '点下面的按钮继续，或者回到学习首页。'}
          </p>

          {reviewed > 0 && (
            <div className="review-done-count" aria-label={`本轮评过 ${reviewed} 张卡`}>
              <span className="review-done-count-label">本轮已评</span>
              <span className="review-done-count-num">
                <strong>{reviewed}</strong>
                <span>张</span>
              </span>
            </div>
          )}

          <div className="review-done-stats">
            <span><strong>{stats?.today ?? '—'}</strong>今日学过（张）</span>
            <span><strong>{stats?.streak ?? '—'}</strong>连续天数</span>
            <span><strong>{stats?.total_reviews ?? '—'}</strong>累计复习（次）</span>
          </div>

          {stats && (
            <p className="review-done-quota">
              今日 新卡 {stats.today_new}/{stats.new_per_day} · 复习 {stats.today_review}/{stats.rev_per_day}
              {stats.today_relearn > 0 ? ` · 重学 ${stats.today_relearn}` : ''}
              {stats.new_remaining > 0 ? ` · 还有 ${stats.new_remaining} 张新卡没学` : ''}
            </p>
          )}

          {topics.length > 0 && (
            <p className="review-done-topics">
              覆盖 {topics.length} 个专题：{topics.slice(0, 5).join(' · ')}
              {topics.length > 5 ? ' 等' : ''}
            </p>
          )}

          {nextDue && finishedAll && (
            <p className="review-done-next">
              <span className="review-done-next-dot" aria-hidden />
              下次可学：{nextDue}
            </p>
          )}

          {stats && <Heatmap days={stats.days} />}

          <div className="review-done-actions">
            {remaining > 0 ? (
              <button type="button" className="review-btn" onClick={continueRound}>
                继续复习 · 还剩 {remaining} 张
              </button>
            ) : (
              <button type="button" className="review-btn" onClick={continueRound}>
                再检查一次
              </button>
            )}
            <Link href="/study" className="review-btn ghost">回到学习</Link>
          </div>

          {hitRevLimit && (
            <p className="review-done-help">
              今天复习额度已满，还有 {overflow} 张到期卡，明天继续（额度可在设置里调整）。
            </p>
          )}
          {hitNewLimit && !hitRevLimit && (
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
            <span>限额内复习 <strong>{loaded ? counts.review : '—'}</strong></span>
            <span>到期总量 <strong>{loaded ? backlog : '—'}</strong></span>
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
        <div
          className={`review-panel${phase === 'question' ? ' is-question' : ''}`}
          aria-live="polite"
          aria-busy={busy}
        >
          <div className="review-meta">
            <span>{card.question?.topic || card.qid}</span>
            {card.question?.pages && <span>{card.question.pages}</span>}
            {originHrefOf(card) && (
              <Link className="review-origin" href={originHrefOf(card) as string} target="_blank" rel="noreferrer">
                查看原文 ↗
              </Link>
            )}
            <span className="review-state">{STATE_LABEL[card.state] || card.state}</span>
          </div>

          <h1 className="review-question">{card.question?.title || '（题目内容缺失）'}</h1>
          {card.question?.aliases && card.question.aliases.length > 0 && (
            <p className="review-alias">别名：{card.question.aliases.join('；')}</p>
          )}

          {phase === 'question' ? (
            <>
              <button
                type="button"
                className="review-reveal"
                onClick={() => void reveal()}
                disabled={revealing}
              >
                {revealing ? '正在载入原文…' : '显示答案'}
                {!revealing && <kbd>空格</kbd>}
              </button>
              <div className="review-undo-row">
                <button
                  type="button"
                  className="review-undo"
                  onClick={() => void undo()}
                  disabled={!canUndo}
                  title={canUndo ? '撤销最近一次评分' : '还没有可撤销的评分'}
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
                  <span aria-hidden>↩</span>
                  <span className="review-undo-text">撤销</span>
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

      {(phase === 'question' || phase === 'answer') && (
        <p className="review-shortcuts">
          空格 显示答案 · 1–4 评分 · U 撤销 · Esc 结束本轮
        </p>
      )}

      {toast && <div className="review-toast">{toast}</div>}
    </div>
  );
}

function formatNextDue(epochSeconds: number): string {
  const due = new Date(epochSeconds * 1000);
  const now = new Date();
  if (due.getTime() < now.getTime() - 60_000) return '现在';
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((dayStart(due) - dayStart(now)) / 86_400_000);
  const hm = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
  if (days <= 0) return `今天 ${hm}`;
  if (days === 1) return '明天';
  if (days === 2) return '后天';
  return `${due.getMonth() + 1} 月 ${due.getDate()} 日`;
}
