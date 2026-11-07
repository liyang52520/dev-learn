import { Link } from 'react-router-dom'

import { AdminTopbar } from '../AdminTopbar'
import { StudySettings } from './StudySettings'

export default function AdminStudyPage() {
  return (
    <>
      <AdminTopbar />
      <main className="admin-page">
        <div className="admin-page-head">
          <div>
            <p className="admin-kicker">SPACED REPETITION</p>
            <h1>学习设置</h1>
            <p className="admin-lede">
              复习上限与学习进度存在本机 collection，不在仓库文件里。数据推送与合并见
              <Link to="/admin/backup">「备份」</Link>。
            </p>
          </div>
        </div>
        <StudySettings />
      </main>
    </>
  )
}
