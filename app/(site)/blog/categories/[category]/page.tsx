import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublishedPosts } from '@/lib/posts';
import PostRow from '@/components/PostRow';
import { IconArrow } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  return { title: `分类 · ${decodeURIComponent(category)}` };
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const decoded = decodeURIComponent(category);
  const posts = getPublishedPosts().filter((post) => post.categories.includes(decoded));

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          CATEGORY
        </p>
        <h1>{decoded}</h1>
        <p>{posts.length} 篇文章</p>
      </header>

      {posts.length > 0 ? (
        <div className="post-list">
          {posts.map((post, index) => (
            <PostRow key={post.slug} post={post} index={index} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>这个分类下还没有文章。</p>
        </div>
      )}

      <div className="section-foot">
        <Link href="/blog/categories" className="text-link">
          全部分类
          <IconArrow />
        </Link>
      </div>
    </div>
  );
}
