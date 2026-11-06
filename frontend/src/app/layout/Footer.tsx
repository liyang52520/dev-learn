import { Link } from 'react-router-dom'

import { SITE } from './Header'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark">YG</span>
          <div>
            <strong>{SITE.name}</strong>
            <p>记录技术，也记录日子。</p>
          </div>
        </div>
        <div className="footer-links">
          <Link to="/">博客</Link>
          <Link to="/study">学习</Link>
          <a href={SITE.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            GitHub
          </a>
          <a href={`mailto:${SITE.email}`}>邮件</a>
        </div>
        <p className="footer-copy">
          © {new Date().getFullYear()} {SITE.name} · 用文件写作，用代码记录。
        </p>
      </div>
    </footer>
  )
}
