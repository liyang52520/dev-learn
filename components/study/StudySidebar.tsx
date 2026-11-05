'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StudyQuestionIndex } from '@/lib/study';
import { IconSearch } from '@/components/Icons';

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
  questions: StudyQuestionIndex[];
  activeId: string;
}

export default function StudySidebar({ topic, topics, questions, activeId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return questions;
    return questions.filter((question) =>
      `${question.no} ${question.title} ${question.aliases.join(' ')}`.toLowerCase().includes(keyword),
    );
  }, [questions, query]);

  const activeIndex = questions.findIndex((question) => question.id === activeId);

  useEffect(() => {
    const link = activeRef.current;
    const list = link?.closest('.question-list');
    if (!link || !(list instanceof HTMLElement)) return;
    const listRect = list.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    if (linkRect.top < listRect.top) {
      list.scrollTop -= listRect.top - linkRect.top;
    } else if (linkRect.bottom > listRect.bottom) {
      list.scrollTop += linkRect.bottom - listRect.bottom;
    }
  }, [activeId]);

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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索本题库…"
            aria-label="搜索题目"
          />
          <kbd>/</kbd>
        </div>
      </div>

      <div className="question-list" role="list">
        {filtered.map((question) => {
          const href = `/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(question.id)}`;
          const active = pathname === href;
          return (
            <Link
              key={question.id}
              href={href}
              ref={active ? activeRef : undefined}
              className={active ? 'question-item active' : 'question-item'}
            >
              <span className="question-no">{String(question.no).padStart(2, '0')}</span>
              <span className="question-title">{question.title}</span>
            </Link>
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
