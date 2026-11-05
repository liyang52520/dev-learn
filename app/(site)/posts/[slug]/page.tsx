import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getPost, getPublishedPosts } from '@/lib/posts';
import ArticleView from '@/components/ArticleView';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost('posts', slug);
  if (!post) return { title: '文章不存在' };
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost('posts', slug);
  if (!post) notFound();

  const posts = getPublishedPosts();
  const index = posts.findIndex((item) => item.slug === post.slug);
  const older = index >= 0 ? posts[index + 1] : undefined;
  const newer = index > 0 ? posts[index - 1] : undefined;

  return (
    <div className="page-shell article-page">
      <ArticleView post={post} prev={older} next={newer} />
    </div>
  );
}
