import { Link } from 'react-router-dom'

import { ArrowRightIcon } from '@/shared/components/Icons'
import type { TopicSummary } from '@/types/models'

export function TopicCard({ topic }: { topic: TopicSummary }) {
  return (
    <Link
      to={topic.firstQid ? `/study/${encodeURIComponent(topic.id)}/${encodeURIComponent(topic.firstQid)}` : '/study'}
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
          <ArrowRightIcon className="icon" />
        </span>
      </div>
    </Link>
  )
}
