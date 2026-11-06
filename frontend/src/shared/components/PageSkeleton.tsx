/** 首个路由 chunk 到达前的骨架，类名沿用旧站 .sk-* 体系。 */
export function PageSkeleton() {
  return (
    <div className="page-shell sk-page-shell" aria-busy="true" aria-label="页面加载中">
      <header className="page-hero sk-hero">
        <span className="skeleton sk-line sk-eyebrow" />
        <span className="skeleton sk-block sk-hero-title" />
        <span className="skeleton sk-line sk-hero-sub" />
      </header>
      <div className="sk-post-list">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="sk-post-row">
            <div className="sk-post-date">
              <span className="skeleton sk-block sk-day" />
              <span className="skeleton sk-line sk-month" />
            </div>
            <div className="sk-post-main">
              <span className="skeleton sk-line sk-post-title" />
              <span className="skeleton sk-line sk-post-excerpt" />
              <div className="sk-meta">
                <span className="skeleton sk-block sk-pill" />
                <span className="skeleton sk-line sk-tag" />
                <span className="skeleton sk-line sk-tag" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
