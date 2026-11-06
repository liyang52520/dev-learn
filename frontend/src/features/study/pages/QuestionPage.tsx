import { useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { EvidencePanel } from '../components/EvidencePanel'
import { QuestionContent } from '../components/QuestionContent'
import { QuestionSidebar } from '../components/QuestionSidebar'
import { useQuestion, useTopic } from '../hooks'

export default function QuestionPage() {
  const { topic = '', qid = '' } = useParams()
  const topicQuery = useTopic(topic)
  const questionQuery = useQuestion(topic, qid)

  useEffect(() => {
    if (questionQuery.data) document.title = `${questionQuery.data.title} · Java 面试宝典`
    return () => {
      document.title = "YG's Blog"
    }
  }, [questionQuery.data])

  if (questionQuery.error || topicQuery.error) {
    return (
      <div className="page-shell">
        <div className="empty-state">题目不存在，或链接已经失效。</div>
      </div>
    )
  }
  if (!topicQuery.data || !questionQuery.data) {
    return (
      <div className="page-shell">
        <p className="muted">正在加载题目…</p>
      </div>
    )
  }

  return (
    <div className="study-page">
      <QuestionSidebar topic={topicQuery.data} currentQid={qid} />
      <QuestionContent question={questionQuery.data} />
      <EvidencePanel groups={questionQuery.data.evidence} />
    </div>
  )
}
