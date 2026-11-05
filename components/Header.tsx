'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { IconMoon, IconSearch, IconSun } from '@/components/Icons';

// 搜索弹层只在按 / 或 ⌘K 之后才有用，从首屏 hydration 的关键路径里拆出去单独加载。
const SearchDialog = dynamic(() => import('@/components/SearchDialog'), { ssr: false });

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
    setReady(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    localStorage.setItem('yg-theme', next ? 'dark' : 'light');
  }

  return (
    <button className="icon-button" type="button" onClick={toggle} aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}>
      {ready && dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}

export default function Header() {
  const pathname = usePathname() || '/';
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerHidden, setHeaderHidden] = useState(false);
  const hiddenRef = useRef(false);
  const isStudy = pathname.startsWith('/study');
  const isBlog = !isStudy && !pathname.startsWith('/admin');

  useEffect(() => {
    let lastY = window.scrollY;
    let downDistance = 0;
    let lastToggle = 0;
    let queued = false;

    function applyHidden(next: boolean) {
      if (hiddenRef.current === next) return;
      hiddenRef.current = next;
      setHeaderHidden(next);
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const y = window.scrollY;
        const delta = y - lastY;
        lastY = y;

        if (y < 120) {
          downDistance = 0;
          applyHidden(false);
          return;
        }

        if (delta <= 0) {
          downDistance = 0;
          return;
        }

        downDistance += delta;
        if (hiddenRef.current || downDistance < 80) return;

        const now = performance.now();
        if (now - lastToggle < 200) return;

        applyHidden(true);
        lastToggle = now;
        downDistance = 0;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    hiddenRef.current = false;
    setHeaderHidden(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle('header-hidden', headerHidden);
    return () => document.body.classList.remove('header-hidden');
  }, [headerHidden]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <header className={headerHidden ? 'site-header is-hidden' : 'site-header'}>
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="返回首页">
            <span className="brand-mark">YG</span>
            <span className="brand-text">
              <strong>YG&apos;s Blog</strong>
              <small>CODE · LIFE</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="主导航">
            <Link href="/" className={isBlog ? 'nav-link active' : 'nav-link'}>
              博客
            </Link>
            <Link href="/study" className={isStudy ? 'nav-link active' : 'nav-link'}>
              学习
            </Link>
          </nav>

          <div className="header-actions">
            <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索">
              <IconSearch />
              <span>搜索</span>
              <kbd>⌘K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
