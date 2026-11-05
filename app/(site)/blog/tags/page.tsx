import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublishedPosts } from '@/lib/posts';
import { IconArrow } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '标签',
  description: '按标签浏览文章。',
};

export default function TagsPage() {
  const posts = getPublishedPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  const tags = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          TAGS
        </p>
        <h1>标签</h1>
        <p>一共 {tags.length} 个标签，{posts.length} 篇文章。</p>
      </header>

      {tags.length === 0 ? (
        <div className="empty-state">
          <p>还没有标签。</p>
        </div>
      ) : (
        <div className="tag-cloud">
          {tags.map(([tag, count]) => (
            <Link key={tag} href={`/blog/tags/${encodeURIComponent(tag)}`} className="tag-chip">
              <span>{tag}</span>
              <em>{count}</em>
            </Link>
          ))}
        </div>
      )}

      <div className="section-foot">
        <Link href="/blog/categories" className="text-link">
          按分类浏览
          <IconArrow />
        </Link>
      </div>
    </div>
  );
}
