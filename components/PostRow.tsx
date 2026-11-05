import Link from 'next/link';
import type { PostMeta } from '@/lib/types';
import { IconArrow } from '@/components/Icons';

export default function PostRow({ post, index }: { post: PostMeta; index?: number }) {
  return (
    <Link href={`/posts/${encodeURIComponent(post.slug)}`} className="post-row">
      <div className="post-row-date">
        <span className="post-row-day">{post.displayDate.slice(8, 10)}</span>
        <span className="post-row-month">{post.displayDate.slice(0, 7)}</span>
      </div>
      <div className="post-row-main">
        <div className="post-row-top">
          {typeof index === 'number' && <span className="post-row-index">{String(index + 1).padStart(2, '0')}</span>}
          <h3>{post.title}</h3>
        </div>
        {post.excerpt && <p>{post.excerpt}</p>}
        <div className="post-row-meta">
          {post.categories.map((category) => (
            <span key={category} className="meta-pill">
              {category}
            </span>
          ))}
          {post.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="meta-tag">
              #{tag}
            </span>
          ))}
          <span className="meta-time">{post.readingTime} 分钟</span>
        </div>
      </div>
      <span className="post-row-arrow" aria-hidden="true">
        <IconArrow />
      </span>
    </Link>
  );
}
