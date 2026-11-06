import type { ReviewDay } from './types';

/**
 * 复习热力图：26 周 × 7 天，单色四档，不放边框和网格线。
 * 只在结算页出现 —— 复习过程中看它没有意义。
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

  return (
    <div className="heatmap-wrap">
      <div className="heatmap" role="img" aria-label="最近 26 周复习次数">
        {cells.map((cell) => (
          <span
            key={cell.date.toISOString()}
            className={`heatmap-cell heatmap-l${cell.future ? 'future' : level(cell.count)}`}
            title={cell.future ? '' : `${toIso(cell.date)} · ${cell.count} 张`}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heatmap-cell heatmap-l${l}`} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

function level(count: number): number {
  if (count <= 0) return 0;
  if (count < 6) return 1;
  if (count < 16) return 2;
  if (count < 31) return 3;
  return 4;
}

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
