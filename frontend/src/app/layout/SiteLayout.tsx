import { Outlet } from 'react-router-dom'

import { Footer } from './Footer'
import { Header } from './Header'

export function SiteLayout() {
  return (
    <div className="site">
      <Header />
      <main className="site-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
