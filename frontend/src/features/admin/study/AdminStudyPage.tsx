import { Link, useSearchParams } from 'react-router-dom'

import { AdminTopbar } from '../AdminTopbar'
import { StudyBankTab } from './StudyBankTab'
import { StudySettings } from './StudySettings'
import { StudyStatsTab } from './StudyStatsTab'

type Tab = 'stats' | 'bank' | 'settings'

export default function AdminStudyPage() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab = requested === 'settings' || requested === 'bank' ? requested : 'stats'
  const switchTab = (next: Tab) => setParams(next === 'stats' ? {} : { tab: next }, { replace: true })

  return (
    <>
      <AdminTopbar />
      <main className="admin-page study-admin-page">
        <div className="admin-page-head">
          <div>
            <p className="admin-kicker">SPACED REPETITION</p>
            <h1>学习与统计</h1>
            <p className="admin-lede">
              复习上限与学习进度存在本机 collection，不在仓库文件里。数据推送与合并见
              <Link to="/admin/backup">「备份」</Link>。
            </p>
          </div>
        </div>

        <div className="study-admin-layout">
          <nav className="study-admin-nav" aria-label="学习后台分区">
            <button
              type="button"
              className={tab === 'stats' ? 'is-active' : undefined}
              aria-current={tab === 'stats' ? 'page' : undefined}
              onClick={() => switchTab('stats')}
            >
              统计
              <span>进度、趋势与到期预测</span>
            </button>
            <button
              type="button"
              className={tab === 'bank' ? 'is-active' : undefined}
              aria-current={tab === 'bank' ? 'page' : undefined}
              onClick={() => switchTab('bank')}
            >
              题库
              <span>题目编辑、证据与卡片同步</span>
            </button>
            <button
              type="button"
              className={tab === 'settings' ? 'is-active' : undefined}
              aria-current={tab === 'settings' ? 'page' : undefined}
              onClick={() => switchTab('settings')}
            >
              设置
              <span>每日新卡与复习上限</span>
            </button>
          </nav>

          <div className="study-admin-content">
            {tab === 'stats' ? <StudyStatsTab /> : null}
            {tab === 'bank' ? <StudyBankTab /> : null}
            {tab === 'settings' ? <StudySettings /> : null}
          </div>
        </div>
      </main>
    </>
  )
}
