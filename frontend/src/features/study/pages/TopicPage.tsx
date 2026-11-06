import { Navigate, useParams } from 'react-router-dom'

import { useTopic } from '../hooks'

export default function TopicPage() {
  const { topic = '' } = useParams()
  const { data, isPending, error } = useTopic(topic)

  if (error) {
    return (
      <div className="page-shell">
        <div className="empty-state">专题不存在或已被移除。</div>
      </div>
    )
  }
  if (isPending || !data) {
    return (
      <div className="page-shell">
        <p className="muted">正在加载专题…</p>
      </div>
    )
  }
  const first = data.questions[0]
  if (!first) {
    return (
      <div className="page-shell">
        <div className="empty-state">这个专题还没有题目。</div>
      </div>
    )
  }
  return (
    <Navigate
      to={`/study/${encodeURIComponent(data.id)}/${encodeURIComponent(first.id)}`}
      replace
    />
  )
}
