import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { logout } from './api'
import { ArrowRightIcon, MoonIcon, SunIcon } from '@/shared/components/Icons'
import { useTheme } from '@/shared/hooks'

export function AdminTopbar() {
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const client = useQueryClient()

  const quit = async () => {
    await logout()
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
        <Link to="/admin">文章</Link>
        <Link to="/admin/study">学习</Link>
        <Link to="/">
          查看站点
          <ArrowRightIcon className="icon" />
        </Link>
      </nav>
      <div className="admin-topbar-right">
        <span className="admin-env">LOCAL</span>
        <button type="button" className="icon-button" onClick={toggle} aria-label="切换主题">
          {theme === 'dark' ? <SunIcon className="icon" /> : <MoonIcon className="icon" />}
        </button>
        <button type="button" className="admin-button ghost small" onClick={() => void quit()}>
          退出
        </button>
      </div>
    </header>
  )
}
