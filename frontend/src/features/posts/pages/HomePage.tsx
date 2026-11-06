import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'

import { PostRow } from '../components/PostRow'
import { usePosts } from '../hooks'
import { fetchCategories, fetchTags } from '@/features/blog/api'
import { Pagination } from '@/shared/components/Pagination'

export default function HomePage() {
  const [params] = useSearchParams()
  const parsed = Number.parseInt(params.get('page') ?? '1', 10)
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  const { data, isPending } = usePosts(page)
  const tags = useQuery({ queryKey: ['blog', 'tags'], queryFn: fetchTags })
  const categories = useQuery({ queryKey: ['blog', 'categories'], queryFn: fetchCategories })

  const hrefOf = (target: number) => (target <= 1 ? '/' : `/?page=${target}`)

  return (
    <div className="page-shell home-page">
      <header className="page-hero home-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          YG's Blog
        </p>
        <h1>
          写代码，
          <br />
          <span className="serif">也写生活。</span>
        </h1>
        <p>这里记录技术问题、源码链路和日常思考。没有速成，只有把一件事慢慢想清楚。</p>
        <div className="hero-stats">
          <Link to="/blog/archive" className="hero-stat">
            <strong>{data?.total ?? '—'}</strong>
            <span>篇文章</span>
          </Link>
          <Link to="/blog/categories" className="hero-stat">
            <strong>{categories.data?.items.length ?? '—'}</strong>
            <span>个分类</span>
          </Link>
          <Link to="/blog/tags" className="hero-stat">
            <strong>{tags.data?.items.length ?? '—'}</strong>
            <span>个标签</span>
          </Link>
        </div>
      </header>

      <section className="section">
        {data && data.items.length > 0 ? (
          <>
            <div className="post-list">
              {data.items.map((post, index) => (
                <PostRow key={post.slug} post={post} index={(page - 1) * data.limit + index} />
              ))}
            </div>
            <Pagination page={page} total={data.total} limit={data.limit} hrefOf={hrefOf} />
          </>
        ) : (
          <div className="empty-state">
            {isPending ? <p>正在加载文章…</p> : <p>还没有已发布的文章。去管理页写第一篇吧。</p>}
          </div>
        )}
      </section>
    </div>
  )
}
