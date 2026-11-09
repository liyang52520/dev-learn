import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { logout } from './api'
import { LogoutIcon, MoonIcon, SettingsIcon, SunIcon } from '@/shared/components/Icons'
import { useTheme } from '@/shared/hooks'

// 伪装页是后端静态目录，不走路由，链接要带站点前缀
const DISGUISE_HREF = `${import.meta.env.BASE_URL}disguise/`

export function AdminTopbar() {
  const { pathname } = useLocation()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const isPosts = pathname === '/admin' || pathname.startsWith('/admin/edit') || pathname.startsWith('/admin/preview')

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
    <header className="admin-topbar">
      <Link to="/admin" className="admin-brand">
        <span>YG</span>
        <strong>Studio</strong>
        <em>内容管理</em>
      </Link>
      <nav>
        <Link to="/admin" className={isPosts ? 'is-active' : undefined}>
          文章
        </Link>
        <Link to="/admin/study" className={pathname.startsWith('/admin/study') ? 'is-active' : undefined}>
          学习
        </Link>
        <Link to="/admin/backup" className={pathname.startsWith('/admin/backup') ? 'is-active' : undefined}>
          备份
        </Link>
      </nav>
      <div className="admin-topbar-right">
        <button
          type="button"
          className="icon-button"
          onClick={toggle}
          aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
        >
          {theme === 'dark' ? <SunIcon className="icon" /> : <MoonIcon className="icon" />}
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
              <Link role="menuitem" to="/" onClick={() => setMenuOpen(false)}>
                返回站点
              </Link>
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
    </header>
  )
}
