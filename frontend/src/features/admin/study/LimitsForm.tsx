import { useEffect, useState } from 'react'

import { errorMessage } from '@/shared/api/client'
import type { ReviewConfig, ReviewStats } from '@/types/models'

import { saveStudyConfig } from '../api'

type Props = {
  config: ReviewConfig
  stats: ReviewStats | null
  onSaved: () => void
}

export function LimitsForm({ config, stats, onSaved }: Props) {
  const [newPerDay, setNewPerDay] = useState(String(config.newPerDay))
  const [revPerDay, setRevPerDay] = useState(String(config.revPerDay))
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setNewPerDay(String(config.newPerDay))
    setRevPerDay(String(config.revPerDay))
  }, [config.newPerDay, config.revPerDay])

  const previewNew = Number(newPerDay)
  const previewRev = Number(revPerDay)
  const previewReady =
    newPerDay.trim() !== '' &&
    revPerDay.trim() !== '' &&
    Number.isInteger(previewNew) &&
    Number.isInteger(previewRev) &&
    previewNew >= 0 &&
    previewRev >= 0 &&
    previewNew <= 9999 &&
    previewRev <= 9999

  const newChanged = previewReady && previewNew !== config.newPerDay
  const revChanged = previewReady && previewRev !== config.revPerDay

  const save = async () => {
    if (!previewReady) {
      setNotice('两个上限都要填 0–9999 的整数，不能留空')
      return
    }
    if (!newChanged && !revChanged) {
      setNotice('额度没有变化，无需保存')
      return
    }
    const warnings: string[] = []
    if (previewNew === 0 || previewRev === 0) warnings.push('设为 0 会暂停对应类型的卡，直到你改回')
    if (previewNew >= config.newPerDay * 2 || previewRev >= config.revPerDay * 2) {
      warnings.push(
        `额度将明显提高（新卡 ${config.newPerDay} → ${previewNew}，复习 ${config.revPerDay} → ${previewRev}），每天花的时间会明显增加`,
      )
    }
    if (warnings.length > 0 && !window.confirm(`${warnings.join('；')}。确定要保存吗？`)) return

    setBusy(true)
    setNotice('')
    try {
      await saveStudyConfig({ newPerDay: previewNew, revPerDay: previewRev })
      setNotice('已保存，下一次取卡立即生效（改小立刻生效，改大当天也会补回）')
      onSaved()
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="study-admin-card">
      <h3>每日上限</h3>
      <p className="study-admin-hint">
        写入本机 collection 的 deck 配置（{config.deck}），与 Anki 桌面版 Deck Options 是同一份设置。
        这是<b>每天的上限，不是每天的任务</b>；设成 0 等于暂停；改小立刻生效，改大当天也会补回。
      </p>
      <p className="study-admin-hint">
        两项额度彼此独立：新卡额度只限制首次学习的卡数；复习额度只统计已经学过、按计划回到队列的卡。
        学习步骤（1 / 10 分钟）不占用任何一项额度。但<b>复习额度用尽后，新卡也会停发</b>。
      </p>
      <p className="study-admin-hint">
        学习步骤：{config.learningSteps?.length ? `${config.learningSteps.join(' / ')} 分钟` : '默认'} · 调度：
        {config.fsrsEnabled ? 'FSRS 已启用' : 'SM-2（FSRS 未启用）'}
      </p>
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
      {previewReady && stats && (
        <p className="study-admin-preview">
          保存后：每天最多学 {previewNew} 张新卡、复习 {previewRev} 张。
          {previewNew > 0
            ? `剩余 ${stats.newRemaining} 张新卡按这个速度需要 ${formatDays(Math.ceil(stats.newRemaining / previewNew))}`
            : '新卡将暂停发放'}
          {previewRev > 0 && stats.dueTotal > 0
            ? `；${stats.dueTotal} 张到期卡约需 ${formatDays(Math.ceil(stats.dueTotal / previewRev))} 清完`
            : ''}
        </p>
      )}
      <button type="button" className="admin-button primary" disabled={busy} onClick={() => void save()}>
        保存
      </button>
      {notice && <p className="study-admin-notice">{notice}</p>}
    </div>
  )
}

function formatDays(days: number): string {
  if (days <= 1) return '1 天'
  if (days <= 60) return `${days} 天`
  if (days <= 365) return `约 ${Math.round(days / 30)} 个月`
  return `约 ${(days / 365).toFixed(1)} 年`
}
