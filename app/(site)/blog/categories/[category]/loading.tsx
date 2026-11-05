// 路由切换时的即时骨架，避免白屏等待服务端渲染。
import PageSkeleton from '@/components/PageSkeleton';

export default function Loading() {
  return <PageSkeleton variant="blog" />;
}
