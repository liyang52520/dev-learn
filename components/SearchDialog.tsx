'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SearchResult } from '@/lib/search';
import { IconClose, IconSearch } from '@/components/Icons';
import { withBasePath } from '@/lib/base-path';

export default function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    const timer = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(withBasePath(`/api/search?q=${encodeURIComponent(keyword)}`), { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => {
          setResults(data.results || []);
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="全站搜索" onMouseDown={onClose}>
      <div className="search-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input-row">
          <IconSearch size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="全文搜索文章正文与面试题答案…"
            aria-label="搜索关键词"
          />
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭搜索">
            <IconClose />
          </button>
        </div>

        <div className="search-body">
          {!query.trim() && (
            <div className="search-empty">
              <p className="search-empty-title">搜点什么？</p>
              <div className="search-suggestions">
                {['JVM', 'Spring', 'Redis', 'MySQL', '线程池', 'TCP'].map((word) => (
                  <button key={word} type="button" onClick={() => setQuery(word)}>
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && loading && <p className="search-status">正在搜索…</p>}

          {query.trim() && !loading && results.length === 0 && (
            <p className="search-status">没有找到「{query.trim()}」相关内容。</p>
          )}

          {results.length > 0 && (
            <ul className="search-results">
              {results.map((result) => (
                <li key={`${result.type}-${result.href}`}>
                  <Link href={result.href} onClick={onClose} className="search-result">
                    <span className={`search-badge ${result.type}`}>{result.badge}</span>
                    <span className="search-result-main">
                      <strong>{result.title}</strong>
                      <small>{result.subtitle}</small>
                      {result.snippet && <em>{result.snippet}</em>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="search-footer">
          <span>↵ 打开</span>
          <span>esc 关闭</span>
          <span>正文全文检索 · 空格分词</span>
        </div>
      </div>
    </div>
  );
}
