import Link from 'next/link';
import type { StudyTopicSummary } from '@/lib/study';
import { IconArrow } from '@/components/Icons';

export default function StudyTopicCard({ topic }: { topic: StudyTopicSummary }) {
  return (
    <Link
      href={`/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(topic.firstQid)}`}
      className="study-card"
      style={{ ['--card-accent' as string]: topic.accent }}
    >
      <div className="study-card-top">
        <span className="study-card-no">{topic.no}</span>
        <span className="study-card-label">{topic.label}</span>
      </div>
      <h3>{topic.title}</h3>
      <p>{topic.subtitle}</p>
      <div className="study-card-foot">
        <span>
          {topic.count} 题 · {topic.pages} 页
        </span>
        <span className="study-card-arrow">
          <IconArrow />
        </span>
      </div>
    </Link>
  );
}
