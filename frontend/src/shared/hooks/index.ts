import { useCallback, useEffect, useState } from 'react'

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
