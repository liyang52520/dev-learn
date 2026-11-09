export function formatDuration(ms: number): string {
  if (ms <= 0) return '—'
  const minutes = ms / 60000
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} 分钟`
  const hours = minutes / 60
  if (hours < 100) return `${hours.toFixed(hours < 10 ? 1 : 0)} 小时`
  return `${Math.round(hours)} 小时`
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
