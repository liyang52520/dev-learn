import { apiGet } from '@/shared/api/client'
import type { PageOfPosts, PostDetail } from '@/types/models'

export function fetchPosts(page: number, limit = 8): Promise<PageOfPosts> {
  return apiGet<PageOfPosts>('/api/posts', { page, limit })
}

export function fetchPost(slug: string): Promise<PostDetail> {
  return apiGet<PostDetail>(`/api/posts/${encodeURIComponent(slug)}`)
}
