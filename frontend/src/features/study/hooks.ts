import { useQuery } from '@tanstack/react-query'

import { fetchQuestion, fetchStudyIndex, fetchTopic } from './api'

export function useStudyIndex() {
  return useQuery({ queryKey: ['study', 'index'], queryFn: fetchStudyIndex, staleTime: 5 * 60_000 })
}

export function useTopic(topic: string) {
  return useQuery({
    queryKey: ['study', 'topic', topic],
    queryFn: () => fetchTopic(topic),
    enabled: topic.length > 0,
  })
}

export function useQuestion(topic: string, qid: string) {
  return useQuery({
    queryKey: ['study', 'question', topic, qid],
    queryFn: () => fetchQuestion(topic, qid),
    enabled: topic.length > 0 && qid.length > 0,
  })
}
