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
    const newJump = previewNew > config.newPerDay && previewNew >= config.newPerDay * 2
    const revJump = previewRev > config.revPerDay && previewRev >= config.revPerDay * 2
    if (newJump || revJump) {
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
        当前节奏：
        {config.learningSteps?.length
          ? `新卡答完后，会在 ${config.learningSteps.map((step) => `${step} 分钟`).join('、')}后再出现，走完这些步骤就进入长期复习。`
          : '新卡答完后会按默认节奏再出现几次，然后进入长期复习。'}
        {config.fsrsEnabled ? '之后的复习间隔由系统自动计算（FSRS 算法）。' : '之后的复习间隔由系统按 SM-2 算法计算。'}
      </p>
      <p className="study-admin-hint">
        <b>新卡 / 天</b>：每天最多拿出多少张没学过的卡，一张新卡只扣一次。
        <br />
        <b>复习 / 天</b>：每天最多复习多少张以前学过、今天到期的卡。
      </p>
      <p className="study-admin-hint">
        新卡学完后会按上面的学习步骤再出现几次，这些重复不扣新卡额度，也不占复习额度：
        额度按“卡”算，不按“看卡次数”算。
      </p>
      <p className="study-admin-hint">
        另外，复习额度用完时，新卡也会一起停发，这是 Anki 的默认规则，防止一天学得太多。
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
            ? stats.newRemaining > 0
              ? `剩余 ${stats.newRemaining} 张新卡按这个速度需要 ${formatDays(Math.ceil(stats.newRemaining / previewNew))}`
              : '新卡已经全部学完'
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
