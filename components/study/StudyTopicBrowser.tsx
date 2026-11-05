'use client';

import { useMemo, useState } from 'react';
import StudyTopicCard from '@/components/StudyTopicCard';
import type { StudyTopicSummary } from '@/lib/study';
import { IconSearch } from '@/components/Icons';

export default function StudyTopicBrowser({ topics }: { topics: StudyTopicSummary[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return topics;
    return topics.filter((topic) =>
      `${topic.title} ${topic.label} ${topic.subtitle} ${topic.no}`.toLowerCase().includes(keyword),
    );
  }, [topics, query]);

  return (
    <>
      <div className="study-browser-bar">
        <div className="study-browser-search">
          <IconSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="筛选专题关键词…"
            aria-label="筛选专题"
          />
        </div>
        <span className="study-browser-count">
          {filtered.length} / {topics.length} 个专题
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="study-grid study-all-grid">
          {filtered.map((topic) => (
            <StudyTopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>没有匹配的专题。</p>
        </div>
      )}
    </>
  );
}
