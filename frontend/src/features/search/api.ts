import { apiGet } from '@/shared/api/client'
import type { SearchResponse } from '@/types/models'

export function searchAll(query: string): Promise<SearchResponse> {
  return apiGet<SearchResponse>('/api/search', { q: query })
}
