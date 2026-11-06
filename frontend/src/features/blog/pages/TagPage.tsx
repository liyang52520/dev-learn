import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { fetchByTag } from '../api'
import { PostRow } from '@/features/posts/components/PostRow'

export default function TagPage() {
  const { tag = '' } = useParams()
  const { data, isPending } = useQuery({
    queryKey: ['blog', 'tag', tag],
    queryFn: () => fetchByTag(tag),
    enabled: tag.length > 0,
  })

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Tag
        </p>
        <h1>#{tag}</h1>
        <p>
          {data ? `${data.total} 篇文章` : '正在加载…'} ·{' '}
          <Link className="text-link" to="/blog/tags">
            全部标签
          </Link>
        </p>
      </header>
      {isPending ? (
        <p className="muted">正在加载…</p>
      ) : data && data.items.length > 0 ? (
        <div className="post-list">
          {data.items.map((post, index) => (
            <PostRow key={post.slug} post={post} index={index} />
          ))}
        </div>
      ) : (
        <div className="empty-state">这个标签下还没有文章。</div>
      )}
    </div>
  )
}
