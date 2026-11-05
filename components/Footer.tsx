import Link from 'next/link';
import { SITE } from '@/lib/types';
import { IconGithub } from '@/components/Icons';

export default function Footer() {
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
          <Link href="/">博客</Link>
          <Link href="/study">学习</Link>
          <a href={SITE.github} target="_blank" rel="noreferrer" aria-label="GitHub">
            <IconGithub />
          </a>
        </div>
        <p className="footer-copy">
          © {SITE.since}–{new Date().getFullYear()} {SITE.author} · Built with Next.js
        </p>
      </div>
    </footer>
  );
}
