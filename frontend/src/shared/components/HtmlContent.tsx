import { useEffect, useLayoutEffect, useRef } from 'react'

type Props = {
  html: string
  className?: string
}

type Katex = typeof import('katex').default

function renderMath(root: HTMLElement, katex: Katex) {
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
    const root = ref.current
    if (!root || !root.querySelector('[data-tex]')) return
    let cancelled = false
    // 公式与样式按需加载：没有数学内容时不必为 KaTeX 付 76KB。
    void (async () => {
      const [katex] = await Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      if (!cancelled && ref.current) renderMath(ref.current, katex.default)
    })()
    return () => {
      cancelled = true
    }
  }, [html])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-code-copy]')
      if (!button) return
      const block = button.closest('.code-block')
      const code = block?.querySelector('pre')?.textContent ?? ''
      button.classList.remove('is-copied', 'is-copy-failed')
      try {
        await navigator.clipboard.writeText(code)
        button.textContent = '已复制'
        button.classList.add('is-copied')
      } catch {
        button.textContent = '复制失败'
        button.classList.add('is-copy-failed')
      }
      window.setTimeout(() => {
        button.textContent = '复制'
        button.classList.remove('is-copied', 'is-copy-failed')
      }, 1600)
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
