import { useEffect, useState } from 'react'

/** 顶部阅读进度条：只读滚动位置，不碰正文 DOM。 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight
      setProgress(height > 0 ? Math.min(1, window.scrollY / height) : 0)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return <div className="reading-progress" style={{ transform: `scaleX(${progress})` }} aria-hidden="true" />
}
