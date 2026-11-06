import { Link } from 'react-router-dom'

import { ArrowRightIcon } from '@/shared/components/Icons'
import { HtmlContent } from '@/shared/components/HtmlContent'
import type { PostDetail } from '@/types/models'
import { MobileToc, Toc } from './Toc'

export function ArticleView({ post }: { post: PostDetail }) {
  const { meta } = post
  return (
    <article className="article">
      <header className="article-header">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          BLOG NOTES
        </p>
        <h1>{meta.title}</h1>
        <div className="article-meta">
          <span className="article-date">{meta.displayDateTime}</span>
          {meta.categories.length > 0 && (
            <span className="article-category">
              {meta.categories.map((category, index) => (
                <span key={category}>
                  {index > 0 && ' / '}
                  <Link to={`/blog/categories/${encodeURIComponent(category)}`}>{category}</Link>
                </span>
              ))}
            </span>
          )}
          <span>{meta.readingTime} 分钟阅读</span>
          {meta.tags.length > 0 && (
            <span className="article-tags">
              {meta.tags.map((tag) => (
                <Link key={tag} to={`/blog/tags/${encodeURIComponent(tag)}`} className="article-tag">
                  #{tag}
                </Link>
              ))}
            </span>
          )}
        </div>
      </header>

      <MobileToc items={post.toc} />

      <div className="article-shell">
        <div className="article-main">
          {meta.cover && (
            <div className="article-cover">
              <img src={meta.cover} alt={meta.title} loading="lazy" decoding="async" />
            </div>
          )}
          <HtmlContent html={post.html} className="prose" />
        </div>
        <aside className="article-aside">
          {post.toc.length > 0 ? (
            <Toc items={post.toc} />
          ) : (
            <div className="aside-author">
              <span className="aside-mark">YG</span>
              <p>记录技术，也记录日子。</p>
            </div>
          )}
        </aside>
      </div>

      <footer className="article-footer">
        {(post.prev || post.next) && (
          <div className="article-pager">
            {post.prev ? (
              <Link to={`/posts/${encodeURIComponent(post.prev.slug)}`} className="pager-link prev">
                <small>上一篇</small>
                <strong>{post.prev.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {post.next ? (
              <Link to={`/posts/${encodeURIComponent(post.next.slug)}`} className="pager-link next">
                <small>下一篇</small>
                <strong>{post.next.title}</strong>
                <ArrowRightIcon className="icon" />
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </footer>
    </article>
  )
}
