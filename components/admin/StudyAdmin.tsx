'use client';

import { useCallback, useEffect, useState } from 'react';
import { withBasePath } from '@/lib/base-path';
import Heatmap from '@/components/review/Heatmap';
import type { ReviewConfig, ReviewStats } from '@/components/review/types';

/**
 * 管理后台的「学习」设置。
 *
 * 注意：这里改的是本机 Anki collection 的 deck 配置，不是仓库文件——
 * 站点部署到服务器后拿不到本机服务，整页会显示「未运行」。
 */
export default function StudyAdmin() {
  const [config, setConfig] = useState<ReviewConfig | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [newPerDay, setNewPerDay] = useState('');
  const [revPerDay, setRevPerDay] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [configRes, statsRes] = await Promise.all([
        fetch(withBasePath('/api/review/config'), { cache: 'no-store' }),
        fetch(withBasePath('/api/review/stats'), { cache: 'no-store' }),
      ]);
      const configData = await configRes.json();
      const statsData = await statsRes.json();
      if (!configRes.ok || !configData.ok) throw new Error(configData.error || '配置读取失败');
      if (!statsRes.ok || !statsData.ok) throw new Error(statsData.error || '统计读取失败');
      setConfig(configData as ReviewConfig);
      setStats(statsData as ReviewStats);
      setNewPerDay(String((configData as ReviewConfig).new_per_day));
      setRevPerDay(String((configData as ReviewConfig).rev_per_day));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    const newValue = Number(newPerDay);
    const revValue = Number(revPerDay);
    if (!newPerDay.trim() || !revPerDay.trim() || !Number.isFinite(newValue) || !Number.isFinite(revValue)) {
      setNotice('两个上限都要填数字（0–9999），不能留空');
      return;
    }
    if (newValue === 0 || revValue === 0) {
      const ok = window.confirm('设为 0 会暂停对应类型的卡，直到你改回。确定要保存吗？');
      if (!ok) return;
    }
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch(withBasePath('/api/review/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_per_day: Math.max(0, Math.min(9999, newValue)),
          rev_per_day: Math.max(0, Math.min(9999, revValue)),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '保存失败');
      setConfig(data as ReviewConfig);
      setNotice('已保存，下一次取卡立即生效（改小立刻生效，改大当天也会补回）');
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  async function backup() {
    const ok = window.confirm('会先做一份本地快照，然后 commit + push 到 dev-anki 仓库。继续吗？');
    if (!ok) return;
    setBusy(true);
    setBackupNotice('');
    try {
      const res = await fetch(withBasePath('/api/review/sync'), { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '备份失败');
      setBackupNotice(data.backup ? `已快照 ${data.backup} 并推送到 dev-anki` : '已推送 dev-anki');
    } catch (err) {
      setBackupNotice(err instanceof Error ? err.message : '备份失败');
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="study-admin-offline">
        <h2>学习服务未运行</h2>
        <p>{error}</p>
        <p>
          在仓库根目录执行 <code>npm run anki</code> 后刷新本页。
        </p>
        <button type="button" className="admin-button" onClick={() => void load()}>
          重试
        </button>
      </div>
    );
  }

  const due = stats ? stats.counts.new + stats.counts.learning + stats.counts.review : 0;

  return (
    <div className="study-admin">
      <section className="admin-stats study-admin-stats">
        <div>
          <span>今日卡片</span>
          <strong>{stats?.today ?? '—'}</strong>
        </div>
        <div>
          <span>连续天数</span>
          <strong>{stats?.streak ?? '—'}</strong>
        </div>
        <div>
          <span>累计复习</span>
          <strong>{stats?.total_reviews ?? '—'}</strong>
        </div>
        <div>
          <span>今日可学</span>
          <strong>{due}</strong>
        </div>
        <div>
          <span>新卡</span>
          <strong>{stats?.counts.new ?? '—'}</strong>
        </div>
        <div>
          <span>学习中</span>
          <strong>{stats?.counts.learning ?? '—'}</strong>
        </div>
      </section>

      <section className="study-admin-grid">
        <div className="study-admin-card">
          <h3>每日上限</h3>
          <p className="study-admin-hint">
            写入本机 collection 的 deck 配置（{config?.deck}），与 Anki 桌面版 Deck Options 是同一份设置。<br />
            这是<b>每天的上限，不是每天的任务</b>；设成 0 等于暂停；改小立刻生效，改大当天也会补回。
          </p>
          <label>
            <span>新卡 / 天</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={newPerDay}
              onChange={(event) => setNewPerDay(event.target.value)}
            />
          </label>
          <label>
            <span>复习 / 天</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={revPerDay}
              onChange={(event) => setRevPerDay(event.target.value)}
            />
          </label>
          {stats && config && (
            <p className="study-admin-hint study-admin-pace">
              今天已学 {stats.today_new} 张新卡 · 队列里还有 {stats.counts.new} 张新卡可发 ·{' '}
              剩余 {stats.new_remaining} 张没学过，
              按 {config.new_per_day || 1}/天 约需{' '}
              {Math.ceil(stats.new_remaining / Math.max(1, config.new_per_day))} 天过完一遍。
            </p>
          )}
          <button type="button" className="admin-button primary" disabled={busy} onClick={() => void save()}>
            保存
          </button>
          {notice && <p className="study-admin-notice">{notice}</p>}
        </div>

        <div className="study-admin-card">
          <h3>数据安全</h3>
          <p className="study-admin-hint">
            collection 存在本机 <code>anki-svc/data/</code>，是独立仓库 dev-anki。服务每 10 分钟自动快照、
            15 分钟自动推送；这里可以立刻执行一次。
          </p>
          <ul className="study-admin-list">
            <li>本地快照：保留最近 30 份</li>
            <li>远端：git@github.com:liyang52520/dev-anki.git</li>
          </ul>
          <button type="button" className="admin-button" disabled={busy} onClick={() => void backup()}>
            立即快照并推送
          </button>
          {backupNotice && <p className="study-admin-notice">{backupNotice}</p>}
        </div>
      </section>

      {stats && stats.days.length > 2 && (
        <section className="study-admin-card study-admin-heatmap">
          <h3>最近 26 周</h3>
          <Heatmap days={stats.days} />
        </section>
      )}
    </div>
  );
}
