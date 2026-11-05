'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UIEvent } from 'react';
import type { StudyQuestionNav } from '@/lib/study';
import PrefetchLink, { prefetchIntent } from '@/components/PrefetchLink';
import { IconSearch } from '@/components/Icons';

// 切题时路由内容整体重建，左侧列表的滚动位置会归零。
// 按专题把滚动位置记在 sessionStorage，重建后先恢复原位，再决定要不要把当前题滚进视野。
const SCROLL_KEY_PREFIX = 'study-sidebar-scroll:';

function readListScroll(topicId: string): number | null {
  try {
    const raw = window.sessionStorage.getItem(SCROLL_KEY_PREFIX + topicId);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function writeListScroll(topicId: string, scrollTop: number) {
  try {
    window.sessionStorage.setItem(SCROLL_KEY_PREFIX + topicId, String(Math.max(0, Math.round(scrollTop))));
  } catch {
    // 隐私模式等场景下 sessionStorage 不可用，退化为不缓存位置。
  }
}

function clearListScroll(topicId: string) {
  try {
    window.sessionStorage.removeItem(SCROLL_KEY_PREFIX + topicId);
  } catch {
    // 同上。
  }
}

export interface TopicOption {
  id: string;
  title: string;
  accent: string;
  firstQid: string;
  count: number;
}

interface Props {
  topic: {
    id: string;
    no: string;
    title: string;
    label: string;
    count: number;
  };
  topics: TopicOption[];
  questions: StudyQuestionNav[];
}

export default function StudySidebar({ topic, topics, questions }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);
  const hadStoredScrollRef = useRef(false);
  const preFilterScrollRef = useRef<number | null>(null);
  const centerNextRef = useRef(false);
  const pendingScrollRef = useRef<number | null>(null);
  const writeFrameRef = useRef<number | null>(null);

  const questionHrefOf = useCallback(
    (qid: string) => `/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(qid)}`,
    [topic.id],
  );
  const activeQuestion = questions.find((question) => pathname === questionHrefOf(question.id));
  const activeId = activeQuestion?.id ?? '';
  const activeIndex = activeQuestion ? questions.indexOf(activeQuestion) : -1;

  // 让当前题待在视野里：已完整可见就不动；有历史位置时只做最小移动；否则居中。
  // forceCenter 用于“从搜索结果跳进某题”：全量列表刚恢复，直接把这一题摆到列表中部。
  const revealActive = useCallback((list: HTMLElement, forceCenter = false) => {
    const active = list.querySelector<HTMLElement>('.question-item.active');
    if (!active) return;
    const listRect = list.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    if (!forceCenter) {
      if (activeRect.top >= listRect.top && activeRect.bottom <= listRect.bottom) return;
      if (hadStoredScrollRef.current) {
        if (activeRect.top < listRect.top) {
          list.scrollTop -= listRect.top - activeRect.top;
        } else {
          list.scrollTop += activeRect.bottom - listRect.bottom;
        }
        return;
      }
    }
    // 首次进入或直接打开深链（没有历史位置）：把当前题放到列表中部，而不是贴在最底下。
    list.scrollTop += (activeRect.top + activeRect.bottom - listRect.top - listRect.bottom) / 2;
  }, []);

  // 列表挂载时先恢复上次的滚动位置，再决定要不要把当前题滚进视野。
  // ref 回调发生在浏览器绘制之前：客户端切题时不会出现“先画在顶部再跳过去”的闪动；
  // 首次硬加载要先等 hydration，服务端已画出的列表无法在此时回滚。
  const attachList = useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node;
      if (!node) {
        restoredRef.current = false;
        return;
      }
      if (restoredRef.current) return;
      restoredRef.current = true;
      const stored = readListScroll(topic.id);
      hadStoredScrollRef.current = stored !== null;
      if (stored !== null) node.scrollTop = stored;
      revealActive(node);
    },
    [revealActive, topic.id],
  );

  function handleListScroll(event: UIEvent<HTMLDivElement>) {
    // 过滤状态下滚的是筛选后的列表，不能拿来覆盖全量列表的位置。
    if (query.trim()) return;
    hadStoredScrollRef.current = true;
    pendingScrollRef.current = event.currentTarget.scrollTop;
    if (writeFrameRef.current !== null) return;
    // 滚动很密集，攒到下一帧再写，避免每个 scroll 事件都同步落一次 sessionStorage。
    writeFrameRef.current = window.requestAnimationFrame(() => {
      writeFrameRef.current = null;
      const value = pendingScrollRef.current;
      pendingScrollRef.current = null;
      if (value !== null) writeListScroll(topic.id, value);
    });
  }

  // 卸载（切题重建）时把最后一帧没写进去的位置补上。
  useEffect(
    () => () => {
      if (writeFrameRef.current === null) return;
      window.cancelAnimationFrame(writeFrameRef.current);
      writeFrameRef.current = null;
      const value = pendingScrollRef.current;
      pendingScrollRef.current = null;
      if (value !== null) writeListScroll(topic.id, value);
    },
    [topic.id],
  );

  // 搜索会改变列表内容：进入搜索时清掉缓存（点搜索结果时按“无历史位置”重新居中），
  // 清空搜索时恢复搜索前的位置，并保证当前题回到视野里。
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (query.trim()) {
      clearListScroll(topic.id);
      return;
    }
    const saved = preFilterScrollRef.current;
    preFilterScrollRef.current = null;
    if (saved !== null) list.scrollTop = saved;
    const forceCenter = centerNextRef.current;
    centerNextRef.current = false;
    revealActive(list, forceCenter);
  }, [query, topic.id, revealActive]);

  // 侧栏跨题常驻，切题后要收掉搜索：否则新题可能不在筛选结果里，左侧没有高亮。
  // 从筛选结果点进来的，相当于“跳转到这一题”，全量列表恢复后把它居中。
  useEffect(() => {
    if (!query.trim()) return;
    preFilterScrollRef.current = null;
    centerNextRef.current = true;
    setQuery('');
  }, [pathname]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return questions;
    return questions.filter((question) =>
      `${question.no} ${question.title} ${question.aliases.join(' ')}`.toLowerCase().includes(keyword),
    );
  }, [questions, query]);

  // 组件跨题常驻时（activeId 变化）也要把当前题带回视野。
  useEffect(() => {
    const list = listRef.current;
    if (list) revealActive(list);
  }, [activeId, topic.id, revealActive]);

  // 空闲时预取当前题前后各 1–2 题：连续 ↑↓ 或点“上一题/下一题”时内容基本已经就绪。
  // 只在浏览器空闲时做，且省流模式/2G 下跳过，避免和当前页抢带宽。
  useEffect(() => {
    if (activeIndex < 0) return;
    const targets: string[] = [];
    for (const delta of [-1, 1, -2, 2]) {
      const neighbour = questions[activeIndex + delta];
      if (neighbour) targets.push(questionHrefOf(neighbour.id));
    }
    if (targets.length === 0) return;

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return;

    const requestIdle: (callback: IdleRequestCallback) => number = window.requestIdleCallback
      ? window.requestIdleCallback.bind(window)
      : (callback) => window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 1200);
    const cancelIdle: (handle: number) => void = window.cancelIdleCallback
      ? window.cancelIdleCallback.bind(window)
      : window.clearTimeout.bind(window);

    const handle = requestIdle(() => {
      for (const href of targets) prefetchIntent(router, href);
    });
    return () => cancelIdle(handle);
  }, [activeIndex, questions, questionHrefOf, router]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) {
        if (event.key === 'Escape' && target?.tagName === 'INPUT') {
          setQuery('');
          target.blur();
        }
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const next = questions[activeIndex + delta];
        if (next) {
          event.preventDefault();
          router.push(`/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(next.id)}`);
        }
      }
      if (event.key === '/') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeIndex, questions, router, topic.id]);

  function switchTopic(nextId: string) {
    const target = topics.find((item) => item.id === nextId);
    if (target) router.push(`/study/${encodeURIComponent(target.id)}/${encodeURIComponent(target.firstQid)}`);
  }

  return (
    <aside className="study-sidebar">
      <div className="study-sidebar-head">
        <Link href="/study" className="study-back">
          ← 全部专题
        </Link>
        <div className="topic-select-wrap">
          <span className="topic-accent" style={{ background: topics.find((item) => item.id === topic.id)?.accent }} />
          <select value={topic.id} onChange={(event) => switchTopic(event.target.value)} aria-label="切换专题">
            {topics.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}（{item.count}）
              </option>
            ))}
          </select>
        </div>
        <div className="study-sidebar-title">
          <h2>{topic.title}</h2>
          <span>
            {topic.no} · {topic.label}
          </span>
        </div>
        <div className="study-search">
          <IconSearch size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              // 进入搜索前记住全量列表的位置，清空搜索时恢复。
              if (!query.trim() && value.trim()) {
                preFilterScrollRef.current = listRef.current?.scrollTop ?? null;
              }
              setQuery(value);
            }}
            placeholder="搜索本题库…"
            aria-label="搜索题目"
          />
          <kbd>/</kbd>
        </div>
      </div>

      <div className="question-list" role="list" ref={attachList} onScroll={handleListScroll}>
        {filtered.map((question) => {
          const href = questionHrefOf(question.id);
          const active = pathname === href;
          return (
            <PrefetchLink
              key={question.id}
              href={href}
              className={active ? 'question-item active' : 'question-item'}
            >
              <span className="question-no">{String(question.no).padStart(2, '0')}</span>
              <span className="question-title">{question.title}</span>
            </PrefetchLink>
          );
        })}
        {filtered.length === 0 && <p className="question-empty">没有匹配的题目</p>}
      </div>

      <div className="study-sidebar-foot">
        <span>↑↓ 切题</span>
        <span>
          {activeIndex + 1} / {questions.length}
        </span>
      </div>
    </aside>
  );
}
