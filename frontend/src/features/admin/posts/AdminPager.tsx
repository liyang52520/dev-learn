type Props = {
  page: number
  pageCount: number
  total: number
  onChange: (page: number) => void
}

export function AdminPager({ page, pageCount, total, onChange }: Props) {
  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        共 {total} 篇 · 第 {page} / {pageCount} 页
      </span>
      {pageCount > 1 && (
        <div className="admin-pagination-pages">
          <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>
            上一页
          </button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
            <button
              key={item}
              type="button"
              className={item === page ? 'active' : ''}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            disabled={page === pageCount}
            onClick={() => onChange(page + 1)}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
