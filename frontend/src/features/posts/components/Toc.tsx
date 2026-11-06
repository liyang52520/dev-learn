import { useEffect, useRef, useState } from 'react'

import type { TocItem } from '@/types/models'

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? '')
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const link = activeRef.current
    const nav = link?.closest('.toc')
    if (!link || !(nav instanceof HTMLElement)) return
    const navRect = nav.getBoundingClientRect()
    const linkRect = link.getBoundingClientRect()
    if (linkRect.top < navRect.top) {
      nav.scrollTop -= navRect.top - linkRect.top
    } else if (linkRect.bottom > navRect.bottom) {
      nav.scrollTop += linkRect.bottom - navRect.bottom
    }
  }, [active])

  useEffect(() => {
    if (items.length === 0) return
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => node !== null)
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActive(visible[0].target.id)
          return
        }
        const above = headings.filter((heading) => heading.getBoundingClientRect().top < 120)
        if (above.length > 0) setActive(above[above.length - 1].id)
      },
      { rootMargin: '-100px 0px -65% 0px', threshold: [0, 1] },
    )
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav className="toc" aria-label="本文目录">
      <p className="toc-title">本文目录</p>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.depth >= 3 ? 'toc-sub' : ''}>
            <a
              href={`#${item.id}`}
              ref={active === item.id ? activeRef : undefined}
              className={active === item.id ? 'active' : ''}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function MobileToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null
  return (
    <details className="article-toc-mobile">
      <summary>
        <span>本文目录</span>
        <em>{items.length} 节</em>
      </summary>
      <ul>
        {items.map((item) => (
          <li key={item.id} className={item.depth >= 3 ? 'toc-sub' : ''}>
            <a href={`#${item.id}`}>{item.text}</a>
          </li>
        ))}
      </ul>
    </details>
  )
}
