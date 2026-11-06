import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page-shell">
      <header className="page-hero">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          404
        </p>
        <h1>这一页不存在</h1>
        <p>地址可能写错了，或者内容已经被移走。</p>
      </header>
      <div className="empty-state">
        <p>
          回 <Link className="text-link" to="/">首页</Link> 看看，或者去{' '}
          <Link className="text-link" to="/study">学习</Link> 逛一圈。
        </p>
      </div>
    </div>
  )
}
