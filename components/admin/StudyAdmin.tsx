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
    if (!Number.isInteger(newValue) || !Number.isInteger(revValue)) {
      setNotice('上限必须是整数');
      return;
    }
    const pauses = newValue === 0 || revValue === 0;
    // 额度翻倍以上属于「明显加大负担」，先让用户看一眼影响再保存
    const jumps = config
      ? (config.new_per_day > 0 && newValue >= config.new_per_day * 2)
        || (config.rev_per_day > 0 && revValue >= config.rev_per_day * 2)
      : false;
    const warnings: string[] = [];
    if (pauses) warnings.push('设为 0 会暂停对应类型的卡，直到你改回');
    if (jumps) {
      warnings.push(
        `额度将明显提高（新卡 ${config?.new_per_day} → ${newValue}，复习 ${config?.rev_per_day} → ${revValue}），每天花的时间会明显增加`,
      );
    }
    if (stats?.can_undo) warnings.push('保存会清空「撤销上一张」的历史记录');
    if (warnings.length > 0) {
      const ok = window.confirm(`${warnings.join('；')}。确定要保存吗？`);
      if (!ok) return;
    }
    setBusy(true);
    setNotice('');
    try {
      const res = await fetch(withBasePath('/api/review/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_per_day: newValue,
          rev_per_day: revValue,
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
      setBackupNotice(
        data.backup
          ? `已快照 ${data.backup}；git：${data.git || '已同步'}`
          : `git：${data.git || '已同步'}`,
      );
      await load();
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
  const previewNew = Number(newPerDay);
  const previewRev = Number(revPerDay);
  const previewReady = newPerDay.trim() !== '' && revPerDay.trim() !== ''
    && Number.isInteger(previewNew) && Number.isInteger(previewRev)
    && previewNew >= 0 && previewRev >= 0;
  const newChanged = Boolean(config && previewReady && previewNew !== config.new_per_day);
  const revChanged = Boolean(config && previewReady && previewRev !== config.rev_per_day);

  return (
    <div className="study-admin">
      <section className="admin-stats study-admin-stats">
        <div>
          <span>今日学过（张）</span>
          <strong>{stats?.today ?? '—'}</strong>
        </div>
        <div>
          <span>连续天数</span>
          <strong>{stats?.streak ?? '—'}</strong>
        </div>
        <div>
          <span>累计复习（次）</span>
          <strong>{stats?.total_reviews ?? '—'}</strong>
        </div>
        <div>
          <span>今日可学（队列）</span>
          <strong>{stats ? due : '—'}</strong>
        </div>
        <div>
          <span>到期总量</span>
          <strong>{stats?.due_total ?? '—'}</strong>
        </div>
        <div>
          <span>未学新卡</span>
          <strong>{stats?.new_remaining ?? '—'}</strong>
        </div>
      </section>

      {stats && stats.days.length > 0 && (
        <section className="study-admin-card study-admin-heatmap">
          <div className="study-admin-heatmap-head">
            <h3>最近 26 周</h3>
            <span>
              今日 {stats.today} 次 · 连续 {stats.streak} 天 · 累计 {stats.total_reviews} 次
            </span>
          </div>
          <Heatmap days={stats.days} />
        </section>
      )}

      <section className="study-admin-grid">
        <div className="study-admin-card">
          <h3>每日上限</h3>
          <p className="study-admin-hint">
            写入本机 collection 的 deck 配置（{config?.deck}），与 Anki 桌面版 Deck Options 是同一份设置。<br />
            这是<b>每天的上限，不是每天的任务</b>；设成 0 等于暂停；改小立刻生效，改大当天也会补回。
          </p>
          <p className="study-admin-hint">
            两项额度彼此独立：新卡额度只限制首次学习的卡数；复习额度只统计已经学过、按计划回到队列的卡。学习步骤（1 / 10 分钟）不占用任何一项额度。
            <br />
            但<b>复习额度用尽后，新卡也会停发</b>（Anki 的固定规则，无法单独关闭）：当天作答的复习卡达到「复习 / 天」时，即使新卡额度还有剩余，也不会再出新卡。若只想暂停新卡、保留复习，把「新卡 / 天」设为 0。
          </p>
          {config && (
            <p className="study-admin-hint study-admin-sched">
              学习步骤：{config.learning_steps?.length ? `${config.learning_steps.join(' / ')} 分钟` : '默认'}
              {' · '}
              调度：{config.fsrs_enabled ? 'FSRS 已启用' : 'SM-2（FSRS 未启用）'}
            </p>
          )}
          <label className={newChanged ? 'is-changed' : undefined}>
            <span>新卡 / 天</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={newPerDay}
              onChange={(event) => setNewPerDay(event.target.value)}
            />
          </label>
          <label className={revChanged ? 'is-changed' : undefined}>
            <span>复习 / 天</span>
            <input
              type="number"
              min={0}
              max={9999}
              value={revPerDay}
              onChange={(event) => setRevPerDay(event.target.value)}
            />
          </label>
          {previewReady && (
            <p className="study-admin-preview">
              保存后：每天最多学 {previewNew} 张新卡、复习 {previewRev} 张。
              {stats && previewNew > 0
                ? `剩余 ${stats.new_remaining} 张新卡约需 ${Math.ceil(stats.new_remaining / previewNew)} 天学完`
                : '新卡将暂停发放'}
              {stats && previewRev > 0 && stats.due_total > 0
                ? `；${stats.due_total} 张到期卡约需 ${Math.ceil(stats.due_total / previewRev)} 天清完`
                : ''}
            </p>
          )}
          {stats && config && (
            <p className="study-admin-hint study-admin-pace">
              今天已学 {stats.today_new} 张新卡 · 队列里还有 {stats.counts.new} 张可发 ·{' '}
              剩余 {stats.new_remaining} 张没学过，按 {config.new_per_day || 1}/天 约需{' '}
              {Math.ceil(stats.new_remaining / Math.max(1, config.new_per_day))} 天过完一遍。
              {stats.due_total > 0 && (
                <>
                  <br />
                  另有 {stats.due_total} 张到期，按 {config.rev_per_day || 1}/天 约需{' '}
                  {Math.ceil(stats.due_total / Math.max(1, config.rev_per_day))} 天清完；两笔债是叠加的，
                  实际每天要同时做。
                </>
              )}
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
            {stats?.last_backup && (
              <li>
                最近快照：{stats.last_backup.name} · {(stats.last_backup.size / 1024 / 1024).toFixed(1)} MB
                {' · '}{new Date(stats.last_backup.at * 1000).toLocaleString('zh-CN', { hour12: false })}
                {'（共 '}{stats.last_backup.count} 份）
              </li>
            )}
          </ul>
          <button type="button" className="admin-button" disabled={busy} onClick={() => void backup()}>
            立即快照并推送
          </button>
          {backupNotice && <p className="study-admin-notice">{backupNotice}</p>}
        </div>
      </section>
    </div>
  );
}
