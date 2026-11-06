import { useQuery } from '@tanstack/react-query'

import { fetchCategories } from '../api'
import { TermCloud } from '../components/TermCloud'

export default function CategoriesPage() {
  const { data } = useQuery({ queryKey: ['blog', 'categories'], queryFn: fetchCategories })
  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Categories
        </p>
        <h1>分类</h1>
        <p>共 {data?.items.length ?? '…'} 个分类，按文章数量排序。</p>
      </header>
      <TermCloud terms={data?.items ?? []} basePath="/blog/categories" variant="category" />
    </div>
  )
}
