import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { AdminTopbar } from '../AdminTopbar'
import { fetchRawPost, previewMarkdown } from '../api'
import { ArticleView } from '@/features/posts/components/ArticleView'
import { ApiError } from '@/shared/api/client'

export default function AdminPreviewPage() {
  const { type = 'drafts', slug = '' } = useParams()
  const raw = useQuery({
    queryKey: ['admin', 'raw', type, slug],
    queryFn: () => fetchRawPost(type, slug),
    enabled: slug.length > 0,
  })
  const body = raw.data?.post.body ?? ''
  const rendered = useQuery({
    queryKey: ['admin', 'preview', type, slug, body.length],
    queryFn: () => previewMarkdown(body),
    enabled: raw.isSuccess,
  })

  if (raw.error instanceof ApiError && raw.error.status === 404) {
    return (
      <div className="admin-root">
        <AdminTopbar />
        <div className="admin-page">
          <p className="admin-table-empty">文章不存在。</p>
        </div>
      </div>
    )
  }
  if (!raw.data || !rendered.data) {
    return (
      <div className="admin-root">
        <AdminTopbar />
        <div className="admin-page">
          <p className="admin-table-empty">正在生成预览…</p>
        </div>
      </div>
    )
  }

  const post = raw.data.post
  return (
    <div className="admin-root">
      <AdminTopbar />
      <div className="preview-banner">
        <span>整页预览</span>
        <em>
          {type === 'drafts' ? '草稿' : '已发布'} · {post.meta.title}
        </em>
        <Link className="admin-button ghost small" to={`/admin/edit/${type}/${encodeURIComponent(slug)}`}>
          返回编辑
        </Link>
      </div>
      <div className="page-shell article-page preview-article">
        <ArticleView
          post={{
            meta: post.meta,
            html: rendered.data.html,
            toc: rendered.data.toc,
            prev: null,
            next: null,
          }}
        />
      </div>
    </div>
  )
}
