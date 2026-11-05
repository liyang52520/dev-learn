import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublishedPosts } from '@/lib/posts';
import { IconArrow } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '归档',
  description: '按时间浏览全部文章。',
};

export default function ArchivePage() {
  const posts = getPublishedPosts();
  const groups = new Map<string, typeof posts>();
  for (const post of posts) {
    const year = post.displayDate.slice(0, 4);
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(post);
  }
  const years = Array.from(groups.keys()).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          ARCHIVE
        </p>
        <h1>归档</h1>
        <p>按时间倒序排列，一共 {posts.length} 篇文章。</p>
      </header>

      {years.length === 0 ? (
        <div className="empty-state">
          <p>还没有文章。</p>
        </div>
      ) : (
        <div className="archive">
          {years.map((year) => (
            <section key={year} className="archive-year">
              <h2>
                {year}
                <span>{groups.get(year)!.length} 篇</span>
              </h2>
              <ul>
                {groups.get(year)!.map((post) => (
                  <li key={post.slug}>
                    <span className="archive-date">{post.displayDate.slice(5)}</span>
                    <Link href={`/posts/${encodeURIComponent(post.slug)}`}>
                      <span>{post.title}</span>
                      <span className="archive-tags">{post.tags.map((tag) => `#${tag}`).join(' ')}</span>
                      <IconArrow />
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
            <Link href="/blog/categories" className="text-link">
              按分类浏览
              <IconArrow />
            </Link>
            <Link href="/blog/tags" className="text-link">
              按标签浏览
              <IconArrow />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
