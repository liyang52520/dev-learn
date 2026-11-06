import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { searchAll } from '../api'
import { CloseIcon, SearchIcon } from '@/shared/components/Icons'
import { useDebounce } from '@/shared/hooks'

const SUGGESTIONS = ['JVM', 'Spring', 'MySQL', 'Redis', '并发']

type Props = { open: boolean; onClose: () => void }

export function SearchDialog({ open, onClose }: Props) {
  const [query, setQuery] = useState('')
  const debounced = useDebounce(query.trim(), 220)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const { data, isFetching } = useQuery({
    queryKey: ['search', debounced],
    queryFn: () => searchAll(debounced),
    enabled: open && debounced.length > 0,
    staleTime: 60_000,
  })

  const results = data?.results ?? []

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="全站搜索" onMouseDown={onClose}>
      <div className="search-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input-row">
          <SearchIcon className="icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文章、题目、关键词…"
            aria-label="搜索关键词"
          />
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭搜索">
            <CloseIcon className="icon" />
          </button>
        </div>
        <div className="search-body">
          {!query.trim() && (
            <div className="search-empty">
              <p className="search-empty-title">搜点什么？</p>
              <div className="search-suggestions">
                {SUGGESTIONS.map((word) => (
                  <button key={word} type="button" onClick={() => setQuery(word)}>
                    {word}
                  </button>
                ))}
              </div>
            </div>
          )}
          {query.trim() && isFetching && <p className="search-status">正在搜索…</p>}
          {query.trim() && !isFetching && results.length === 0 && (
            <p className="search-status">没有找到「{query.trim()}」相关内容。</p>
          )}
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((result) => (
                <li key={`${result.type}-${result.href}`}>
                  <Link to={result.href} onClick={onClose} className="search-result">
                    <span className={`search-badge ${result.type}`}>{result.badge}</span>
                    <span className="search-result-main">
                      <strong>{result.title}</strong>
                      <small>{result.subtitle}</small>
                      <span>{result.snippet}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="search-footer">
          <span>
            <kbd>Enter</kbd> 打开
          </span>
          <span>
            <kbd>Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  )
}

export default SearchDialog
