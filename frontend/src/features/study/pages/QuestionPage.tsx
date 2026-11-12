import { Fragment, useEffect } from 'react'
import { useParams } from 'react-router-dom'

import { QuestionDetailSkeleton, StudySkeleton } from '@/shared/components/PageSkeleton'
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
  if (!topicQuery.data) {
    return <StudySkeleton />
  }

  return (
    <div className="study-page">
      <QuestionSidebar topic={topicQuery.data} currentQid={qid} />
      {questionQuery.data ? (
        // 按题目 id 重新挂载正文与证据，切题时触发进入动效；左侧列表保持挂载，滚动位置不丢
        <Fragment key={questionQuery.data.id}>
          <QuestionContent question={questionQuery.data} />
          <EvidencePanel groups={questionQuery.data.evidence} />
        </Fragment>
      ) : (
        <QuestionDetailSkeleton />
      )}
    </div>
  )
}
