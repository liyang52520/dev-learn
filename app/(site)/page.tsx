import Link from 'next/link';
import { getPublishedPosts } from '@/lib/posts';
import PostRow from '@/components/PostRow';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 8;

function pageHref(page: number) {
  return page === 1 ? '/' : `/?page=${page}`;
}

function pageItems(current: number, total: number): Array<number | 'gap'> {
  const items: Array<number | 'gap'> = [];
  for (let page = 1; page <= total; page++) {
    if (page === 1 || page === total || Math.abs(page - current) <= 1) {
      items.push(page);
    } else if (items[items.length - 1] !== 'gap') {
      items.push('gap');
    }
  }
  return items;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const posts = getPublishedPosts();
  const categories = new Set(posts.flatMap((post) => post.categories));
  const tags = new Set(posts.flatMap((post) => post.tags));

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const requested = Number.parseInt(pageParam || '1', 10);
  const current = Math.min(Math.max(Number.isNaN(requested) ? 1 : requested, 1), totalPages);
  const start = (current - 1) * PAGE_SIZE;
  const visiblePosts = posts.slice(start, start + PAGE_SIZE);

  return (
    <div className="page-shell home-page">
      <header className="page-hero home-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          CODE · LIFE · NOTES
        </p>
        <h1>
          写代码，
          <br />
          <span className="serif">也写生活。</span>
        </h1>
        <p>这里记录技术问题、源码链路和日常思考。没有速成，只有把一件事慢慢想清楚。</p>
        <div className="hero-stats">
          <Link href="/blog/archive" className="hero-stat">
            <strong>{String(posts.length).padStart(2, '0')}</strong>
            <span>篇文章</span>
          </Link>
          <Link href="/blog/categories" className="hero-stat">
            <strong>{String(categories.size).padStart(2, '0')}</strong>
            <span>个分类</span>
          </Link>
          <Link href="/blog/tags" className="hero-stat">
            <strong>{String(tags.size).padStart(2, '0')}</strong>
            <span>个标签</span>
          </Link>
        </div>
      </header>

      <section className="section">
        {visiblePosts.length > 0 ? (
          <div className="post-list">
            {visiblePosts.map((post, index) => (
              <PostRow key={post.slug} post={post} index={start + index} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>还没有已发布的文章。去管理页写第一篇吧。</p>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="pagination" aria-label="文章分页">
            {current > 1 ? (
              <Link className="pagination-link" href={pageHref(current - 1)}>
                上一页
              </Link>
            ) : (
              <span className="pagination-link disabled">上一页</span>
            )}
            {pageItems(current, totalPages).map((item, index) =>
              item === 'gap' ? (
                <span key={`gap-${index}`} className="pagination-gap">
                  …
                </span>
              ) : (
                <Link
                  key={item}
                  className={item === current ? 'pagination-link active' : 'pagination-link'}
                  href={pageHref(item)}
                >
                  {item}
                </Link>
              )
            )}
            {current < totalPages ? (
              <Link className="pagination-link" href={pageHref(current + 1)}>
                下一页
              </Link>
            ) : (
              <span className="pagination-link disabled">下一页</span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
