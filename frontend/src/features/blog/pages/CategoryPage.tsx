import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { fetchByCategory } from '../api'
import { PostRow } from '@/features/posts/components/PostRow'

export default function CategoryPage() {
  const { category = '' } = useParams()
  const { data, isPending } = useQuery({
    queryKey: ['blog', 'category', category],
    queryFn: () => fetchByCategory(category),
    enabled: category.length > 0,
  })

  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Category
        </p>
        <h1>{category}</h1>
        <p>
          {data ? `${data.total} 篇文章` : '正在加载…'} ·{' '}
          <Link className="text-link" to="/blog/categories">
            全部分类
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
        <div className="empty-state">这个分类下还没有文章。</div>
      )}
    </div>
  )
}
