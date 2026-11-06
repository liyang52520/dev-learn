import { apiGet } from '@/shared/api/client'
import type { Archive, FilterResponse, TermsResponse } from '@/types/models'

export function fetchArchive(): Promise<Archive> {
  return apiGet<Archive>('/api/blog/archive')
}

export function fetchTags(): Promise<TermsResponse> {
  return apiGet<TermsResponse>('/api/blog/tags')
}

export function fetchCategories(): Promise<TermsResponse> {
  return apiGet<TermsResponse>('/api/blog/categories')
}

export function fetchByTag(tag: string): Promise<FilterResponse> {
  return apiGet<FilterResponse>(`/api/blog/tags/${encodeURIComponent(tag)}`)
}

export function fetchByCategory(category: string): Promise<FilterResponse> {
  return apiGet<FilterResponse>(`/api/blog/categories/${encodeURIComponent(category)}`)
}
