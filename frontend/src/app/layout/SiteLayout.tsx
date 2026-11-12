import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { PageSkeleton } from '@/shared/components/PageSkeleton'
import { Footer } from './Footer'
import { Header } from './Header'

export function SiteLayout() {
  return (
    <div className="site">
      <Header />
      <main className="site-main">
        {/* 路由级 Suspense 放在布局内部：切换页面时顶栏和页脚不会被骨架替换掉 */}
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
