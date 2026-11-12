import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { logout } from '@/features/admin/api'
import {
  LogoutIcon,
  MoonIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from '@/shared/components/Icons'
import { useHeaderVisibility, useTheme } from '@/shared/hooks'

const SearchDialog = lazy(() => import('@/features/search/components/SearchDialog'))

// 伪装页是后端静态目录，不走路由，链接要带站点前缀
const DISGUISE_HREF = `${import.meta.env.BASE_URL}disguise/`

const SITE = {
  name: "YG's Blog",
  shortName: 'YG',
  email: '378776683@qq.com',
  github: 'https://github.com/liyang52520',
}

export function Header() {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { hidden, snapping } = useHeaderVisibility(pathname)

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
  const headerClass = `site-header${hidden ? ' is-hidden' : ''}${snapping ? ' is-snap' : ''}`

  const signOut = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // cookie 可能已经失效，仍然离开当前页面。
    }
    client.clear()
    navigate('/admin/login', { replace: true })
  }

  return (
    <header className={headerClass}>
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

          <div className="account-menu-wrap" ref={menuRef}>
            <button
              className={menuOpen ? 'icon-button is-open' : 'icon-button'}
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="设置与账户"
            >
              <SettingsIcon className="icon" />
            </button>
            {menuOpen && (
              <div className="account-menu" role="menu">
                <p className="account-menu-label">站点管理</p>
                <Link role="menuitem" to="/admin" onClick={() => setMenuOpen(false)}>
                  内容后台
                </Link>
                <Link role="menuitem" to="/admin/study" onClick={() => setMenuOpen(false)}>
                  学习设置
                </Link>
                <Link role="menuitem" to="/admin/backup" onClick={() => setMenuOpen(false)}>
                  数据备份
                </Link>
                <a role="menuitem" href={DISGUISE_HREF} onClick={() => setMenuOpen(false)}>
                  伪装学习页
                </a>
                <div className="account-menu-sep" />
                <button
                  role="menuitem"
                  type="button"
                  className="account-menu-danger"
                  onClick={() => void signOut()}
                  disabled={loggingOut}
                >
                  <LogoutIcon className="icon" />
                  {loggingOut ? '退出中…' : '退出登录'}
                </button>
              </div>
            )}
          </div>
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
