import { Link } from 'react-router-dom'

import type { StudyTopicProgress } from '@/types/models'

export function StudyTopicProgressList({ topics }: { topics: StudyTopicProgress[] }) {
  const started = topics.filter((topic) => topic.learned > 0).length
  const finished = topics.filter(
    (topic) => topic.total > 0 && topic.learned >= topic.total,
  ).length

  return (
    <section className="study-admin-card">
      <div className="study-card-head">
        <h3>专题掌握度</h3>
        <span>
          已开始 {started}/{topics.length} · 学完 {finished}
        </span>
      </div>
      <p className="study-admin-hint">
        进度按该专题已学过的卡数算；括号里是「已学 / 题目总数」。点专题名可以回到题库查看。
      </p>
      <ul className="study-topic-list">
        {topics.map((topic) => {
          const percent = topic.total > 0 ? (topic.learned / topic.total) * 100 : 0
          return (
            <li key={topic.id}>
              <div className="study-topic-head">
                <Link to={`/study/${encodeURIComponent(topic.id)}`}>{topic.title}</Link>
                <span>
                  {topic.learned}/{topic.total}
                </span>
              </div>
              <div className="study-topic-track" aria-hidden>
                <span style={{ width: `${percent}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
