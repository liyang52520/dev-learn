import { notFound } from 'next/navigation';
import AdminTopbar from '@/components/admin/AdminTopbar';
import ArticleView from '@/components/ArticleView';
import { getPost } from '@/lib/posts';
import type { PostType } from '@/lib/types';

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type: rawType, slug } = await params;
  if (rawType !== 'posts' && rawType !== 'drafts') notFound();
  const type = rawType as PostType;
  const post = await getPost(type, slug);
  if (!post) notFound();

  return (
    <>
      <AdminTopbar />
      <div className="preview-banner">
        <span>整页预览</span>
        <em>{type === 'drafts' ? '草稿' : '已发布'} · {post.title}</em>
      </div>
      <div className="page-shell article-page preview-article">
        <ArticleView post={post} preview />
      </div>
    </>
  );
}
