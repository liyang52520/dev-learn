import PrefetchLink from '@/components/PrefetchLink';
import type { PostMeta } from '@/lib/types';
import { IconArrow } from '@/components/Icons';

export default function PostRow({ post, index }: { post: PostMeta; index?: number }) {
  // 列表每页只有 8 篇，视口内直接做完整预取：点进去不用再等服务端渲染。
  return (
    <PrefetchLink href={`/posts/${encodeURIComponent(post.slug)}`} prefetch={true} className="post-row">
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
    </PrefetchLink>
  );
}
