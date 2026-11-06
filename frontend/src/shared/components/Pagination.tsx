import { Link } from 'react-router-dom'

type Props = {
  page: number
  total: number
  limit: number
  hrefOf: (page: number) => string
}

function pageWindow(current: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1)
  const items: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(pages - 1, current + 1)
  if (start > 2) items.push('gap')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < pages - 1) items.push('gap')
  items.push(pages)
  return items
}

export function Pagination({ page, total, limit, hrefOf }: Props) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages <= 1) return null
  return (
    <nav className="pagination" aria-label="文章分页">
      {page > 1 ? (
        <Link className="pagination-link" to={hrefOf(page - 1)}>
          上一页
        </Link>
      ) : (
        <span className="pagination-link disabled">上一页</span>
      )}
      {pageWindow(page, pages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="pagination-gap">
            …
          </span>
        ) : (
          <Link
            key={item}
            className={item === page ? 'pagination-link active' : 'pagination-link'}
            to={hrefOf(item)}
          >
            {item}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link className="pagination-link" to={hrefOf(page + 1)}>
          下一页
        </Link>
      ) : (
        <span className="pagination-link disabled">下一页</span>
      )}
    </nav>
  )
}
