import { useQuery } from '@tanstack/react-query'

import { fetchPost, fetchPosts } from './api'

export function usePosts(page: number) {
  return useQuery({ queryKey: ['posts', page], queryFn: () => fetchPosts(page), placeholderData: (prev) => prev })
}

export function usePost(slug: string) {
  return useQuery({
    queryKey: ['post', slug],
    queryFn: () => fetchPost(slug),
    enabled: slug.length > 0,
  })
}
