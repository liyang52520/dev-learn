'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import type { ReviewStats } from '@/components/review/types';

/**
 * 学习首页的复习入口。
 *
 * 服务没运行时：部署在公网（读者看不到本地服务）就整块不渲染；
 * 只有在本机访问时才给一句提示，免得「服务挂了」和「功能被删了」看起来一样。
 */
export default function ReviewLauncher() {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'down'>('loading');
  const [isLocal, setIsLocal] = useState(false);

  useEffect(() => {
    setIsLocal(['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(withBasePath('/api/review/stats'), { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!alive) return;
        if (data && data.ok) {
          setStats(data as ReviewStats);
          setState('ok');
        } else {
          setState('down');
        }
      })
      .catch(() => {
        if (alive) setState('down');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'loading') return null;

  if (!stats) {
    if (!isLocal) return null;
    return (
      <div className="review-launcher review-launcher-off">
        <div className="review-launcher-text">
          <strong>复习服务未启动</strong>
          <span>
            在仓库根目录执行 <code>npm run anki</code>，刷新后这里会出现今日待复习。
          </span>
        </div>
        <Link href="/review" className="review-launcher-btn ghost">
          去看看
        </Link>
      </div>
    );
  }

  const due = stats.counts.new + stats.counts.learning + stats.counts.review;
  const progress = stats.new_per_day > 0
    ? Math.min(100, Math.round((stats.today_new / stats.new_per_day) * 100))
    : 0;

  return (
    <div className="review-launcher">
      <div className="review-launcher-text">
        <p className="eyebrow">
          <span className="eyebrow-dot" />
          SPACED REPETITION
        </p>
        <strong>{due > 0 ? `今日可学 ${due} 张` : '今天的卡清空了'}</strong>
        <span>
          今日已学 {stats.today_new}/{stats.new_per_day} 张新卡 · 连续 {stats.streak} 天 · 累计{' '}
          {stats.total_reviews} 次
        </span>
        <span className="review-launcher-track" aria-hidden>
          <span className="review-launcher-fill" style={{ width: `${progress}%` }} />
        </span>
      </div>
      <Link href="/review" className="review-launcher-btn">
        {due > 0 ? '开始复习' : '查看状态'}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
