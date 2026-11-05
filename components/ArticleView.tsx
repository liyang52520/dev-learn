import Link from 'next/link';
import type { Post, PostMeta } from '@/lib/types';
import Toc from '@/components/Toc';
import ArticleTools from '@/components/ArticleTools';
import { IconArrow } from '@/components/Icons';

interface Props {
  post: Post;
  prev?: PostMeta | null;
  next?: PostMeta | null;
  preview?: boolean;
}

export default function ArticleView({ post, prev, next, preview = false }: Props) {
  return (
    <article className="article">
      <ArticleTools />
      <header className="article-header">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          {preview ? 'PREVIEW' : 'BLOG NOTES'}
        </p>
        <h1>{post.title}</h1>
        <div className="article-meta">
          <span className="article-date">{post.displayDate}</span>
          {post.categories.length > 0 && (
            <span className="article-category">
              {post.categories.map((category, index) => (
                <span key={category}>
                  {index > 0 && ' / '}
                  <Link href={`/blog/categories/${encodeURIComponent(category)}`}>{category}</Link>
                </span>
              ))}
            </span>
          )}
          <span>{post.readingTime} 分钟阅读</span>
          {post.tags.length > 0 && (
            <span className="article-tags">
              {post.tags.map((tag) => (
                <Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="article-tag">
                  #{tag}
                </Link>
              ))}
            </span>
          )}
        </div>
      </header>

      {post.toc.length > 0 && (
        <details className="article-toc-mobile">
          <summary>
            <span>本文目录</span>
            <em>{post.toc.length} 节</em>
          </summary>
          <ul>
            {post.toc.map((item) => (
              <li key={item.id} className={item.depth >= 3 ? 'toc-sub' : ''}>
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="article-shell">
        <div className="article-main">
          {post.cover && (
            <div className="article-cover">
              <img src={post.cover} alt={post.title} />
            </div>
          )}
          <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
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
        {(prev || next) && (
          <div className="article-pager">
            {prev ? (
              <Link href={`/posts/${encodeURIComponent(prev.slug)}`} className="pager-link prev">
                <small>上一篇</small>
                <strong>{prev.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/posts/${encodeURIComponent(next.slug)}`} className="pager-link next">
                <small>下一篇</small>
                <strong>{next.title}</strong>
                <IconArrow />
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </footer>
    </article>
  );
}
