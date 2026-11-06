import { Link } from 'react-router-dom'

import type { TermCount } from '@/types/models'

type Props = {
  terms: TermCount[]
  basePath: string
  variant?: 'tag' | 'category'
  active?: string
}

export function TermCloud({ terms, basePath, variant = 'tag', active }: Props) {
  if (terms.length === 0) return <p className="muted">暂无内容。</p>
  return (
    <div className="tag-cloud">
      {terms.map((term) => (
        <Link
          key={term.name}
          to={`${basePath}/${encodeURIComponent(term.name)}`}
          className={[
            'tag-chip',
            variant === 'category' ? 'category-chip' : '',
            active === term.name ? 'active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span>{term.name}</span>
          <em>{term.count}</em>
        </Link>
      ))}
    </div>
  )
}
