import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { fetchArchive } from '../api'
import { ArrowRightIcon } from '@/shared/components/Icons'

export default function ArchivePage() {
  const { data, isPending } = useQuery({ queryKey: ['blog', 'archive'], queryFn: fetchArchive })
  const years = data?.years ?? []

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          ARCHIVE
        </p>
        <h1>归档</h1>
        <p>按时间倒序排列，一共 {data?.total ?? '…'} 篇文章。</p>
      </header>

      {isPending ? (
        <p className="muted">正在加载…</p>
      ) : years.length === 0 ? (
        <div className="empty-state">
          <p>还没有文章。</p>
        </div>
      ) : (
        <div className="archive">
          {years.map((group) => (
            <section key={group.year} className="archive-year">
              <h2>
                {group.year}
                <span>{group.count} 篇</span>
              </h2>
              <ul>
                {group.posts.map((post) => (
                  <li key={post.slug}>
                    <span className="archive-date">{post.displayDate.slice(5)}</span>
                    <Link to={`/posts/${encodeURIComponent(post.slug)}`}>
                      <span>{post.title}</span>
                      <span className="archive-tags">{post.tags.map((tag) => `#${tag}`).join(' ')}</span>
                      <ArrowRightIcon className="icon" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {years.length > 0 && (
        <div className="section-foot">
          <div className="section-foot-links">
            <Link to="/blog/categories" className="text-link">
              按分类浏览
              <ArrowRightIcon className="icon" />
            </Link>
            <Link to="/blog/tags" className="text-link">
              按标签浏览
              <ArrowRightIcon className="icon" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
