import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import { Pagination } from './Pagination'

function renderPagination(page: number, total: number, limit = 8) {
  return render(
    <MemoryRouter>
      <Pagination page={page} total={total} limit={limit} hrefOf={(next) => `/?page=${next}`} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('Pagination', () => {
  it('只有一页时不渲染', () => {
    const { container } = renderPagination(1, 5)
    expect(container.querySelector('nav')).toBeNull()
  })

  it('渲染上一页/下一页与当前页高亮', () => {
    renderPagination(2, 24)
    expect(screen.getByRole('link', { name: '上一页' }).getAttribute('href')).toBe('/?page=1')
    expect(screen.getByRole('link', { name: '下一页' }).getAttribute('href')).toBe('/?page=3')
    expect(screen.getByRole('link', { name: '2' }).className).toContain('active')
    expect(screen.getByRole('link', { name: '1' }).className).not.toContain('active')
  })

  it('首页禁用上一页', () => {
    renderPagination(1, 16)
    expect(screen.queryByRole('link', { name: '上一页' })).toBeNull()
    expect(screen.getByText('上一页').className).toContain('disabled')
    expect(screen.getByRole('link', { name: '下一页' })).toBeTruthy()
  })

  it('末页禁用下一页', () => {
    renderPagination(2, 16)
    expect(screen.queryByRole('link', { name: '下一页' })).toBeNull()
    expect(screen.getByText('下一页').className).toContain('disabled')
  })

  it('页数很多时折叠成省略号窗口', () => {
    const { container } = renderPagination(10, 200)
    expect(container.querySelectorAll('.pagination-gap').length).toBe(2)
    const labels = [...container.querySelectorAll('.pagination-link')].map((node) => node.textContent)
    expect(labels).toContain('1')
    expect(labels).toContain('10')
  })
})
