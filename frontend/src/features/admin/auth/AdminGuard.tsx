import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { fetchMe } from '../api'

export function AdminGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data, isPending } = useQuery({ queryKey: ['admin', 'me'], queryFn: fetchMe, staleTime: 0 })

  if (isPending) {
    return (
      <div className="admin-root">
        <div className="admin-page">
          <p className="muted">正在校验登录状态…</p>
        </div>
      </div>
    )
  }
  if (!data?.authenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
