import katex from 'katex'
import { useEffect, useLayoutEffect, useRef } from 'react'

import 'katex/dist/katex.min.css'

type Props = {
  html: string
  className?: string
}

function renderMath(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-tex]').forEach((node) => {
    const tex = node.dataset.tex ?? ''
    if (!tex || node.dataset.rendered === '1') return
    try {
      katex.render(tex, node, {
        displayMode: node.classList.contains('math-block'),
        throwOnError: false,
        strict: false,
      })
      node.dataset.rendered = '1'
    } catch {
      node.dataset.rendered = 'error'
    }
  })
}

/** 正文 HTML：统一处理公式渲染与代码复制，文章与题库答案共用。 */
export function HtmlContent({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (ref.current) renderMath(ref.current)
  }, [html])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-code-copy]')
      if (!button) return
      const block = button.closest('.code-block')
      const code = block?.querySelector('pre')?.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        button.textContent = '已复制'
      } catch {
        button.textContent = '复制失败'
      }
      window.setTimeout(() => {
        button.textContent = '复制'
      }, 1600)
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
