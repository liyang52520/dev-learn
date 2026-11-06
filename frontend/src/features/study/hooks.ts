import { useQuery } from '@tanstack/react-query'

import { fetchLapses, fetchStats } from '../review/api'
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

/** 学习首页的复习入口：统计失败才算挂，最近答错拿不到就留空。 */
export function useReviewLauncher() {
  return useQuery({
    queryKey: ['review', 'launcher'],
    queryFn: async () => {
      const stats = await fetchStats()
      const lapses = await fetchLapses()
        .then((data) => data.items)
        .catch(() => [])
      return { stats, lapses }
    },
    // 复习完回到首页要立刻看到新的额度，别被缓存挡住。
    refetchOnMount: 'always',
  })
}
