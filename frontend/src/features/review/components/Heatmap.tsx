import { useRef, useState, type KeyboardEvent } from 'react'

import type { ReviewDay } from '@/types/models'

const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日']
const WEEKS = 26

/** 复习热力图：26 周 × 7 天，单色四档；触屏点按查看当天学过的卡数。 */
export function Heatmap({ days, todayKey }: { days: ReviewDay[]; todayKey: string }) {
  const [selected, setSelected] = useState<number | null>(null)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const byDate = new Map(days.map((day) => [day.date, day.count]))
  // 网格锚定服务端的 Anki 学习日，而不是浏览器自然日，避免时区/凌晨换日错位。
  const today = parseIso(todayKey)
  today.setHours(0, 0, 0, 0)

  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const start = new Date(monday)
  start.setDate(monday.getDate() - (WEEKS - 1) * 7)

  const cells: { date: Date; count: number; future: boolean }[] = []
  for (let i = 0; i < WEEKS * 7; i += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    cells.push({
      date,
      count: byDate.get(toIso(date)) || 0,
      future: date.getTime() > today.getTime(),
    })
  }

  const monthLabels: string[] = new Array(WEEKS).fill('')
  let lastMonth = -1
  for (let week = 0; week < WEEKS; week += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + week * 7)
    if (date.getMonth() !== lastMonth) {
      monthLabels[week] = `${date.getMonth() + 1}月`
      lastMonth = date.getMonth()
    }
  }

  const total = cells.reduce((sum, cell) => sum + (cell.future ? 0 : cell.count), 0)
  const peak = cells.reduce((max, cell) => Math.max(max, cell.future ? 0 : cell.count), 0)
  const scale = thresholds(peak)
  const selectedCell = selected === null ? null : cells[selected]
  // 182 个格子只保留一个 Tab 停靠点，键盘用户不会被热力图困住。
  const lastSelectable = cells.reduce((last, cell, index) => (cell.future ? last : index), -1)
  const focusIndex = selected !== null && !cells[selected].future ? selected : lastSelectable

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const weekStart = Math.floor(index / 7) * 7
    let step: number
    switch (event.key) {
      case 'ArrowLeft':
        step = -7
        break
      case 'ArrowRight':
        step = 7
        break
      case 'ArrowUp':
        step = -1
        break
      case 'ArrowDown':
        step = 1
        break
      case 'Home':
        step = weekStart - index
        break
      case 'End':
        step = weekStart + 6 - index
        break
      default:
        return
    }
    const next = index + step
    if (next < 0 || next >= cells.length || cells[next].future) return
    event.preventDefault()
    setSelected(next)
    cellRefs.current[next]?.focus()
  }

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll">
        <div className="heatmap-months" aria-hidden>
          {monthLabels.map((label, week) => (
            <span key={week}>{label}</span>
          ))}
        </div>
        <div className="heatmap-body">
            <div className="heatmap-days" aria-hidden>
              {WEEKDAY_LABELS.map((label, row) => (
                <span key={row}>{label || '\u00a0'}</span>
              ))}
            </div>
            <div
              className="heatmap"
              role="group"
              aria-label={
                total > 0
                  ? `最近 26 周共复习 ${total} 张次（按卡·天计），单日最高 ${peak} 张`
                  : '最近 26 周还没有复习记录'
              }
            >
              {cells.map((cell, index) => {
                if (cell.future)
                  return <span key={cell.date.toISOString()} className="heatmap-cell is-future" />
                const label = `${toIso(cell.date)} · ${cell.count} 张`
                return (
                  <button
                    key={cell.date.toISOString()}
                    ref={(node) => {
                      cellRefs.current[index] = node
                    }}
                    type="button"
                    className={`heatmap-cell heatmap-l${level(cell.count, scale)}${selected === index ? ' is-selected' : ''}`}
                    title={label}
                    aria-label={label}
                    aria-pressed={selected === index}
                    tabIndex={index === focusIndex ? 0 : -1}
                    onClick={() => setSelected(index)}
                    onKeyDown={(event) => moveFocus(event, index)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      <div className="heatmap-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((value) => (
          <span key={value} className={`heatmap-cell heatmap-l${value}`} />
        ))}
        <span>多</span>
        <span className="heatmap-summary">
          {total > 0 ? `26 周 ${total} 张次 · 单日最高 ${peak} 张` : '还没有复习记录'}
        </span>
      </div>
      <p className="heatmap-detail" aria-live="polite">
        {selectedCell ? `${toIso(selectedCell.date)} · ${selectedCell.count} 张` : '点按任意格子查看当天学过的卡数'}
      </p>
    </div>
  )
}

function thresholds(peak: number): [number, number, number] {
  if (peak <= 4) return [1, 2, 3]
  return [Math.max(1, Math.ceil(peak * 0.2)), Math.max(2, Math.ceil(peak * 0.45)), Math.max(3, Math.ceil(peak * 0.7))]
}

function level(count: number, scale: [number, number, number]): number {
  if (count <= 0) return 0
  if (count < scale[0]) return 1
  if (count < scale[1]) return 2
  if (count < scale[2]) return 3
  return 4
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function parseIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
