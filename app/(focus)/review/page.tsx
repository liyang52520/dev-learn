import type { Metadata } from 'next';
import ReviewSession from '@/components/review/ReviewSession';

export const metadata: Metadata = {
  title: '复习',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  return <ReviewSession />;
}
