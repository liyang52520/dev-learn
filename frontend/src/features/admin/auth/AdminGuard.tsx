import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { PageSkeleton } from '@/shared/components/PageSkeleton'

import { fetchMe } from '../api'

export function AdminGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { data, isPending } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: fetchMe,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  if (isPending) return <PageSkeleton />
  if (!data?.authenticated) {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  return <>{children}</>
}
