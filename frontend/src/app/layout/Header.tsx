import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { MoonIcon, SearchIcon, SunIcon } from '@/shared/components/Icons'
import { useTheme } from '@/shared/hooks'

const SearchDialog = lazy(() => import('@/features/search/components/SearchDialog'))

const SITE = {
  name: "YG's Blog",
  shortName: 'YG',
  email: '378776683@qq.com',
  github: 'https://github.com/liyang52520',
}

export function Header() {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setHidden(y > 180 && y > lastY + 4)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      if (event.key === 'Escape') setSearchOpen(false)
      if (typing) return
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const isBlog = pathname === '/' || pathname.startsWith('/posts') || pathname.startsWith('/blog')
  const isStudy = pathname.startsWith('/study')
  const dark = theme === 'dark'

  return (
    <header className={hidden ? 'site-header is-hidden' : 'site-header'}>
      <div className="header-inner">
        <Link to="/" className="brand" aria-label="返回首页">
          <span className="brand-mark">{SITE.shortName}</span>
          <span className="brand-text">
            <strong>{SITE.name}</strong>
            <small>技术 · 生活 · 长期主义</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="主导航">
          <Link to="/" className={isBlog ? 'nav-link active' : 'nav-link'}>
            博客
          </Link>
          <Link to="/study" className={isStudy ? 'nav-link active' : 'nav-link'}>
            学习
          </Link>
        </nav>

        <div className="header-actions">
          <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-label="搜索">
            <SearchIcon className="icon" />
            <span>搜索</span>
            <kbd>/</kbd>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={toggle}
            aria-label={dark ? '切换到浅色模式' : '切换到深色模式'}
          >
            {dark ? <SunIcon className="icon" /> : <MoonIcon className="icon" />}
          </button>
        </div>
      </div>
      {searchOpen && (
        <Suspense fallback={null}>
          <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
    </header>
  )
}

export { SITE }
