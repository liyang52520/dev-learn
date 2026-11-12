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

function paragraphs(count: number) {
  return Array.from({ length: count }, (_, index) => (
    <span key={index} className="skeleton sk-paragraph" />
  ))
}

/** 文章页骨架：结构与 ArticleView 对齐，数据到达时不会整页跳版。 */
export function ArticleSkeleton() {
  return (
    <div className="page-shell article-page" aria-busy="true" aria-label="文章加载中">
      <article className="article">
        <header className="article-header">
          <div className="article-head-row">
            <span className="skeleton sk-line sk-article-kicker" />
          </div>
          <h1 className="sk-article-heading">
            <span className="skeleton sk-block sk-article-title" />
            <span className="skeleton sk-block sk-article-title sk-article-title-short" />
          </h1>
          <div className="article-meta sk-article-meta">
            <span className="skeleton sk-line sk-meta-date" />
            <span className="skeleton sk-line sk-tag" />
            <span className="skeleton sk-line sk-tag" />
          </div>
        </header>

        <div className="article-shell">
          <div className="article-main sk-article-main">
            {paragraphs(5)}
            <span className="skeleton sk-block sk-article-h2" />
            {paragraphs(4)}
            <span className="skeleton sk-block sk-article-code" />
            {paragraphs(3)}
            <span className="skeleton sk-block sk-article-h2 sk-article-h2-short" />
            {paragraphs(5)}
          </div>
          <aside className="article-aside sk-article-aside">
            <span className="skeleton sk-line sk-aside-title" />
            <span className="skeleton sk-line sk-aside-line" />
            <span className="skeleton sk-line sk-aside-line" />
            <span className="skeleton sk-line sk-aside-line sk-aside-line-short" />
            <span className="skeleton sk-line sk-aside-line" />
            <span className="skeleton sk-line sk-aside-line sk-aside-line-short" />
          </aside>
        </div>
      </article>
    </div>
  )
}

function studySidebarSkeleton() {
  return (
    <aside className="study-sidebar">
      <div className="sk-sidebar-head">
        <span className="skeleton sk-line sk-back" />
        <span className="skeleton sk-block sk-select" />
        <span className="skeleton sk-line sk-topic-title" />
        <span className="skeleton sk-line sk-topic-sub" />
        <span className="skeleton sk-block sk-search" />
      </div>
      <div className="sk-question-list">
        {Array.from({ length: 16 }).map((_, index) => (
          <div key={index} className="sk-question-item">
            <span className="skeleton sk-line sk-qno" />
            <span className="skeleton sk-line sk-qtitle" />
          </div>
        ))}
      </div>
    </aside>
  )
}

function studyMainSkeleton() {
  return (
    <div className="study-main">
      <div className="sk-question-head">
        <span className="skeleton sk-line sk-crumb" />
        <span className="skeleton sk-line sk-kicker" />
        <span className="skeleton sk-block sk-question-title" />
        <span className="skeleton sk-block sk-question-title sk-question-title-short" />
      </div>
      <div className="sk-summary">
        <span className="skeleton sk-line sk-summary-title" />
        <span className="skeleton sk-line sk-summary-line" />
        <span className="skeleton sk-line sk-summary-line sk-summary-line-short" />
      </div>
      <div className="sk-answer">
        <span className="skeleton sk-block sk-answer-h2" />
        {paragraphs(4)}
        <span className="skeleton sk-block sk-answer-code" />
        {paragraphs(5)}
        <span className="skeleton sk-block sk-answer-h2" />
        {paragraphs(3)}
      </div>
    </div>
  )
}

function studyEvidenceSkeleton() {
  return (
    <aside className="study-evidence">
      <div className="sk-evidence-head">
        <span className="skeleton sk-line sk-evidence-title" />
        <span className="skeleton sk-line sk-evidence-count" />
      </div>
      <span className="skeleton sk-line sk-evidence-hint" />
      <span className="skeleton sk-block sk-evidence-shot" />
      <span className="skeleton sk-block sk-evidence-shot" />
    </aside>
  )
}

/** 首次进入题目页：三栏都还没有数据。 */
export function StudySkeleton() {
  return (
    <div className="study-page sk-study" aria-busy="true" aria-label="题目加载中">
      {studySidebarSkeleton()}
      {studyMainSkeleton()}
      {studyEvidenceSkeleton()}
    </div>
  )
}

/** 同一专题内切题：只替换右侧正文与证据，左侧列表保持挂载，滚动位置不丢。 */
export function QuestionDetailSkeleton() {
  return (
    <>
      {studyMainSkeleton()}
      {studyEvidenceSkeleton()}
    </>
  )
}
