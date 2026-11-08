import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Heatmap } from './Heatmap'

afterEach(cleanup)

describe('Heatmap', () => {
  it('网格锚定服务端学习日，而不是浏览器当天', () => {
    render(<Heatmap days={[{ date: '2026-11-08', count: 5 }]} todayKey="2026-11-08" />)

    expect(screen.getByTitle('2026-11-08 · 5 张')).toBeTruthy()
    // 学习日之后的格子不渲染标题，也就不可点。
    expect(screen.queryByTitle('2026-11-09 · 0 张')).toBeNull()
    expect(screen.getByRole('group').getAttribute('aria-label')).toContain('共复习 5 张次')
  })

  it('方向键在格子间移动焦点', () => {
    render(<Heatmap days={[{ date: '2026-11-08', count: 5 }]} todayKey="2026-11-08" />)

    const today = screen.getByTitle('2026-11-08 · 5 张')
    today.focus()
    fireEvent.keyDown(today, { key: 'ArrowLeft' })

    expect(document.activeElement).toBe(screen.getByTitle('2026-11-01 · 0 张'))
  })

  it('换日后今天的格子跟着移动', () => {
    render(<Heatmap days={[{ date: '2026-11-09', count: 2 }]} todayKey="2026-11-09" />)

    expect(screen.getByTitle('2026-11-09 · 2 张')).toBeTruthy()
    expect(screen.queryByTitle('2026-11-08 · 0 张')).not.toBeNull()
  })
})
