import { apiGet, apiSend, apiUpload } from '@/shared/api/client'
import type {
  AdminPostList,
  AuthState,
  FrontMatter,
  PreviewResponse,
  PublishResponse,
  RawPost,
  ReviewConfig,
  ReviewConfigUpdate,
  ReviewStats,
  SyncResult,
  UploadResponse,
} from '@/types/models'

export function login(password: string): Promise<AuthState> {
  return apiSend<AuthState>('POST', '/api/admin/auth/login', { password })
}

export function logout(): Promise<AuthState> {
  return apiSend<AuthState>('POST', '/api/admin/auth/logout')
}

export function fetchMe(): Promise<AuthState> {
  return apiGet<AuthState>('/api/admin/auth/me')
}

export function listAdminPosts(status = '', q = ''): Promise<AdminPostList> {
  return apiGet<AdminPostList>('/api/admin/posts', { status, q })
}

export function fetchRawPost(type: string, slug: string): Promise<{ post: RawPost; type: string }> {
  return apiGet(`/api/admin/posts/${type}/${encodeURIComponent(slug)}`)
}

export function createPost(title: string): Promise<RawPost> {
  return apiSend<RawPost>('POST', '/api/admin/posts', { title })
}

export function savePost(
  type: string,
  slug: string,
  front: FrontMatter,
  body: string,
): Promise<{ ok: boolean }> {
  return apiSend('PUT', `/api/admin/posts/${type}/${encodeURIComponent(slug)}`, { type, front, body })
}

export function publishPost(type: string, slug: string): Promise<PublishResponse> {
  return apiSend('POST', `/api/admin/posts/${type}/${encodeURIComponent(slug)}/publish`)
}

export function unpublishPost(type: string, slug: string): Promise<PublishResponse> {
  return apiSend('POST', `/api/admin/posts/${type}/${encodeURIComponent(slug)}/unpublish`)
}

export function deletePost(type: string, slug: string): Promise<{ ok: boolean }> {
  return apiSend('DELETE', `/api/admin/posts/${type}/${encodeURIComponent(slug)}`)
}

export function previewMarkdown(body: string): Promise<PreviewResponse> {
  return apiSend<PreviewResponse>('POST', '/api/admin/preview', { body })
}

export function uploadImage(file: File): Promise<UploadResponse> {
  return apiUpload<UploadResponse>('/api/admin/upload', file)
}

export function fetchStudyConfig(): Promise<ReviewConfig> {
  return apiGet<ReviewConfig>('/api/admin/study/config')
}

export function saveStudyConfig(config: ReviewConfigUpdate): Promise<ReviewConfig> {
  return apiSend<ReviewConfig>('POST', '/api/admin/study/config', config)
}

export function fetchStudyStats(): Promise<ReviewStats> {
  return apiGet<ReviewStats>('/api/admin/study/stats')
}

export function syncStudy(): Promise<SyncResult> {
  return apiSend<SyncResult>('POST', '/api/admin/study/sync')
}
