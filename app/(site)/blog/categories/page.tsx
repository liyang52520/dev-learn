import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublishedPosts } from '@/lib/posts';
import { IconArrow } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '分类',
  description: '按分类浏览文章。',
};

export default function CategoriesPage() {
  const posts = getPublishedPosts();
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const category of post.categories) counts.set(category, (counts.get(category) || 0) + 1);
  }
  const categories = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          CATEGORIES
        </p>
        <h1>分类</h1>
        <p>一共 {categories.length} 个分类，{posts.length} 篇文章。</p>
      </header>

      {categories.length === 0 ? (
        <div className="empty-state">
          <p>还没有分类。</p>
        </div>
      ) : (
        <div className="tag-cloud">
          {categories.map(([category, count]) => (
            <Link
              key={category}
              href={`/blog/categories/${encodeURIComponent(category)}`}
              className="tag-chip category-chip"
            >
              <span>{category}</span>
              <em>{count}</em>
            </Link>
          ))}
        </div>
      )}

      <div className="section-foot">
        <Link href="/blog/tags" className="text-link">
          按标签浏览
          <IconArrow />
        </Link>
      </div>
    </div>
  );
}
