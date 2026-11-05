// 首次进入某个专题（[topic]/layout.tsx 还不存在）时的整页骨架，含左侧栏。
import PageSkeleton from '@/components/PageSkeleton';

export default function Loading() {
  return <PageSkeleton variant="study" />;
}
