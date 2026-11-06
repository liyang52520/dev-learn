import { apiGet } from '@/shared/api/client'
import type { QuestionDetail, StudyIndex, TopicDetail } from '@/types/models'

export function fetchStudyIndex(): Promise<StudyIndex> {
  return apiGet<StudyIndex>('/api/study')
}

export function fetchTopic(topic: string): Promise<TopicDetail> {
  return apiGet<TopicDetail>(`/api/study/${encodeURIComponent(topic)}`)
}

export function fetchQuestion(topic: string, qid: string): Promise<QuestionDetail> {
  return apiGet<QuestionDetail>(`/api/study/${encodeURIComponent(topic)}/${encodeURIComponent(qid)}`)
}
