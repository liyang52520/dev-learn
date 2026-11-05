// 切题时左侧栏由 [topic]/layout.tsx 常驻，只替换中间答案与右侧截图两栏。
import PageSkeleton from '@/components/PageSkeleton';

export default function Loading() {
  return <PageSkeleton variant="study-content" />;
}
