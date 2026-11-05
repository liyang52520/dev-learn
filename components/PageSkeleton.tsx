// 路由切换时的即时骨架，避免白屏等待服务端渲染。

interface PageSkeletonProps {
  /**
   * blog：博客列表 / 归档 / 标签分类 / 文章页；
   * study：题库整页（含左侧栏，用于跨专题或首次进入）；
   * study-content：题库中间+右侧两栏（左侧栏由 layout 常驻，切题时只换内容）
   */
  variant?: 'blog' | 'study' | 'study-content';
  /** blog 变体专用：列表页（默认）或文章详情页 */
  layout?: 'list' | 'article';
}

const POST_ROWS = 5;
const QUESTION_ROWS = 9;
const EVIDENCE_SHOTS = 3;

function SkeletonLines({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="skeleton sk-line sk-paragraph" />
      ))}
    </>
  );
}

function BlogListSkeleton() {
  return (
    <div className="page-shell sk-page-shell" aria-busy="true" aria-label="页面加载中">
      <header className="page-hero sk-hero">
        <span className="skeleton sk-line sk-eyebrow" />
        <span className="skeleton sk-block sk-hero-title" />
        <span className="skeleton sk-line sk-hero-sub" />
      </header>
      <div className="sk-post-list">
        {Array.from({ length: POST_ROWS }, (_, index) => (
          <div key={index} className="sk-post-row">
            <div className="sk-post-date">
              <span className="skeleton sk-block sk-day" />
              <span className="skeleton sk-line sk-month" />
            </div>
            <div className="sk-post-main">
              <span className="skeleton sk-line sk-post-title" />
              <span className="skeleton sk-line sk-post-excerpt" />
              <span className="skeleton sk-line sk-post-excerpt sk-post-excerpt-short" />
              <div className="sk-meta">
                <span className="skeleton sk-block sk-pill" />
                <span className="skeleton sk-line sk-tag" />
                <span className="skeleton sk-line sk-tag" />
              </div>
            </div>
            <span className="skeleton sk-block sk-arrow" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ArticleSkeleton() {
  return (
    <div
      className="page-shell article-page sk-page-shell"
      aria-busy="true"
      aria-label="页面加载中"
    >
      <header className="article-header sk-article-head">
        <div className="sk-hero-stack">
          <span className="skeleton sk-line sk-eyebrow" />
          <span className="skeleton sk-block sk-article-title" />
          <span className="skeleton sk-block sk-article-title sk-article-title-short" />
          <div className="sk-article-meta">
            <span className="skeleton sk-line sk-meta-date" />
            <span className="skeleton sk-block sk-pill" />
            <span className="skeleton sk-line sk-tag" />
            <span className="skeleton sk-line sk-tag" />
          </div>
        </div>
      </header>
      <div className="article-shell">
        <div className="article-main sk-article-main">
          <SkeletonLines count={4} />
          <span className="skeleton sk-block sk-article-h2" />
          <SkeletonLines count={5} />
          <span className="skeleton sk-block sk-article-code" />
          <SkeletonLines count={4} />
          <span className="skeleton sk-block sk-article-h2 sk-article-h2-short" />
          <SkeletonLines count={3} />
        </div>
        <aside className="article-aside sk-article-aside" aria-hidden="true">
          <span className="skeleton sk-line sk-aside-title" />
          <span className="skeleton sk-line sk-aside-line" />
          <span className="skeleton sk-line sk-aside-line sk-aside-line-short" />
          <span className="skeleton sk-line sk-aside-line" />
          <span className="skeleton sk-line sk-aside-line sk-aside-line-short" />
          <span className="skeleton sk-line sk-aside-line" />
        </aside>
      </div>
    </div>
  );
}

function StudyMainSkeleton({ busy = false }: { busy?: boolean }) {
  return (
    <main
      className="study-main"
      aria-busy={busy || undefined}
      aria-label={busy ? '题目加载中' : undefined}
    >
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
        <span className="skeleton sk-line sk-summary-line" />
      </div>
      <div className="sk-answer">
        <SkeletonLines count={4} />
        <span className="skeleton sk-block sk-answer-h2" />
        <SkeletonLines count={5} />
        <span className="skeleton sk-block sk-answer-code" />
        <SkeletonLines count={3} />
      </div>
    </main>
  );
}

function StudyEvidenceSkeleton({ busy = false }: { busy?: boolean }) {
  return (
    <aside
      className="study-evidence sk-study-evidence"
      aria-busy={busy || undefined}
      aria-label={busy ? '原文出处加载中' : undefined}
    >
      <div className="sk-evidence-head">
        <span className="skeleton sk-line sk-evidence-title" />
        <span className="skeleton sk-line sk-evidence-count" />
      </div>
      <span className="skeleton sk-line sk-evidence-hint" />
      {Array.from({ length: EVIDENCE_SHOTS }, (_, index) => (
        <span key={index} className="skeleton sk-block sk-evidence-shot" />
      ))}
    </aside>
  );
}

function StudySkeleton() {
  return (
    <div className="study-page sk-study" aria-busy="true" aria-label="题目加载中">
      <aside className="study-sidebar">
        <div className="sk-sidebar-head">
          <span className="skeleton sk-line sk-back" />
          <span className="skeleton sk-block sk-select" />
          <span className="skeleton sk-line sk-topic-title" />
          <span className="skeleton sk-line sk-topic-sub" />
          <span className="skeleton sk-block sk-search" />
        </div>
        <div className="sk-question-list">
          {Array.from({ length: QUESTION_ROWS }, (_, index) => (
            <div key={index} className="sk-question-item">
              <span className="skeleton sk-line sk-qno" />
              <span className="skeleton sk-line sk-qtitle" />
            </div>
          ))}
        </div>
      </aside>
      <StudyMainSkeleton />
      <StudyEvidenceSkeleton />
    </div>
  );
}

/** 左侧栏由 [topic]/layout.tsx 常驻，切题时只有这两栏出现骨架。 */
function StudyContentSkeleton() {
  return (
    <>
      <StudyMainSkeleton busy />
      <StudyEvidenceSkeleton busy />
    </>
  );
}

export default function PageSkeleton({ variant = 'blog', layout = 'list' }: PageSkeletonProps) {
  if (variant === 'study') return <StudySkeleton />;
  if (variant === 'study-content') return <StudyContentSkeleton />;
  return layout === 'article' ? <ArticleSkeleton /> : <BlogListSkeleton />;
}
