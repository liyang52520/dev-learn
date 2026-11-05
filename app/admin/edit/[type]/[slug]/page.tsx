import { notFound } from 'next/navigation';
import AdminTopbar from '@/components/admin/AdminTopbar';
import PostEditor from '@/components/admin/PostEditor';
import { getRawPost } from '@/lib/posts';
import type { PostType } from '@/lib/types';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type: rawType, slug } = await params;
  if (rawType !== 'posts' && rawType !== 'drafts') notFound();
  const type = rawType as PostType;
  const post = getRawPost(type, slug);
  if (!post) notFound();

  return (
    <>
      <AdminTopbar />
      <PostEditor type={type} initial={post} />
    </>
  );
}
