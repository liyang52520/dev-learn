import Link from 'next/link';
import type { Metadata } from 'next';
import { getPublishedPosts } from '@/lib/posts';
import PostRow from '@/components/PostRow';
import { IconArrow } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPublishedPosts().filter((post) => post.tags.includes(decoded));

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          TAG
        </p>
        <h1>
          <span className="hash">#</span>
          {decoded}
        </h1>
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
          <p>这个标签下还没有文章。</p>
        </div>
      )}

      <div className="section-foot">
        <Link href="/blog/tags" className="text-link">
          全部标签
          <IconArrow />
        </Link>
      </div>
    </div>
  );
}
