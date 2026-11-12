import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

type Theme = 'light' | 'dark'

const KEY = 'yg-theme'

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  useEffect(() => {
    const dark = theme === 'dark'
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    localStorage.setItem(KEY, theme)
  }, [theme])

  const toggle = useCallback(() => setTheme((value) => (value === 'dark' ? 'light' : 'dark')), [])

  return { theme, toggle }
}

export function useDebounce<T>(value: T, delay = 220): T {
  const [delayed, setDelayed] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return delayed
}

/**
 * 顶栏「下滚隐藏、上滚显示」。
 * 换页时立刻恢复可见并跳过滑入动画，否则从页面下方点进新页面会看到顶栏慢半拍滑下来。
 */
export function useHeaderVisibility(pathname: string) {
  const [hidden, setHidden] = useState(false)
  const [snapping, setSnapping] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const delta = y - lastY.current
      // 只在明确向下时隐藏、明确向上时显示；微小位移保持现状，避免顶栏反复闪现
      if (y <= 180) {
        setHidden(false)
      } else if (delta > 4) {
        setHidden(true)
      } else if (delta < -4) {
        setHidden(false)
      }
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    lastY.current = 0
    setHidden(false)
    setSnapping(true)
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setSnapping(false))
    })
    return () => {
      window.cancelAnimationFrame(outer)
      window.cancelAnimationFrame(inner)
    }
  }, [pathname])

  return { hidden, snapping }
}
