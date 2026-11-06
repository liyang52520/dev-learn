import { useQuery } from '@tanstack/react-query'

import { fetchTags } from '../api'
import { TermCloud } from '../components/TermCloud'

export default function TagsPage() {
  const { data } = useQuery({ queryKey: ['blog', 'tags'], queryFn: fetchTags })
  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          Tags
        </p>
        <h1>标签</h1>
        <p>共 {data?.items.length ?? '…'} 个标签。点一个看看都写了什么。</p>
      </header>
      <TermCloud terms={data?.items ?? []} basePath="/blog/tags" />
    </div>
  )
}
