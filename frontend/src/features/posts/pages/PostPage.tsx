import { useParams } from 'react-router-dom'

import { ArticleView } from '../components/ArticleView'
import { ReadingProgress } from '../components/ReadingProgress'
import { usePost } from '../hooks'
import { NotFoundPage } from '@/app/NotFoundPage'
import { ApiError } from '@/shared/api/client'

export default function PostPage() {
  const { slug = '' } = useParams()
  const { data, error, isPending } = usePost(slug)

  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
  if (isPending) {
    return (
      <div className="page-shell">
        <p className="muted">正在加载文章…</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="page-shell">
        <p className="muted">文章加载失败。</p>
      </div>
    )
  }
  return (
    <div className="page-shell article-page">
      <ReadingProgress />
      <ArticleView post={data} />
    </div>
  )
}
