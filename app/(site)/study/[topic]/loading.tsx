// 专题层（/study/<topic> 重定向页）的骨架：左侧栏由 [topic]/layout.tsx 常驻，这里只盖两栏内容。
import PageSkeleton from '@/components/PageSkeleton';

export default function Loading() {
  return <PageSkeleton variant="study-content" />;
}
