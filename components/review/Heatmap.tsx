import type { ReviewDay } from './types';

/**
 * 复习热力图：26 周 × 7 天，单色四档，不放边框和网格线。
 * 只在结算页 / 设置页出现 —— 复习过程中看它没有意义。
 */
export default function Heatmap({ days }: { days: ReviewDay[] }) {
  const byDate = new Map(days.map((day) => [day.date, day.count]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 从本周一向后推 25 周，保证每列就是一周
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - 25 * 7);

  const weeks = 26;
  const cells: { date: Date; count: number; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({
      date,
      count: byDate.get(toIso(date)) || 0,
      future: date.getTime() > today.getTime(),
    });
  }

  const total = cells.reduce((sum, cell) => sum + (cell.future ? 0 : cell.count), 0);
  const peak = cells.reduce((max, cell) => Math.max(max, cell.future ? 0 : cell.count), 0);
  // 阈值跟着自己的量走：每天 3 张和每天 300 张的人都应该看到四档，而不是一片最深色。
  const scale = thresholds(peak);

  return (
    <div className="heatmap-wrap">
      <div
        className="heatmap"
        role="img"
        aria-label={
          total > 0
            ? `最近 26 周共复习 ${total} 次，单日最高 ${peak} 次`
            : '最近 26 周还没有复习记录'
        }
      >
        {cells.map((cell) => (
          <span
            key={cell.date.toISOString()}
            className={`heatmap-cell heatmap-l${cell.future ? 'future' : level(cell.count, scale)}`}
            title={cell.future ? '' : `${toIso(cell.date)} · ${cell.count} 次`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heatmap-cell heatmap-l${l}`} />
        ))}
        <span>多</span>
        <span className="heatmap-summary">
          {total > 0 ? `26 周 ${total} 次 · 单日最高 ${peak} 次` : '还没有复习记录'}
        </span>
      </div>
    </div>
  );
}

function thresholds(peak: number): [number, number, number] {
  if (peak <= 0) return [1, 2, 3];
  if (peak <= 4) return [1, 2, 3];
  return [
    Math.max(1, Math.ceil(peak * 0.2)),
    Math.max(2, Math.ceil(peak * 0.45)),
    Math.max(3, Math.ceil(peak * 0.7)),
  ];
}

function level(count: number, scale: [number, number, number]): number {
  if (count <= 0) return 0;
  if (count < scale[0]) return 1;
  if (count < scale[1]) return 2;
  if (count < scale[2]) return 3;
  return 4;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
