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
              复习上限、学习进度与数据备份。这些状态存在本机 collection，不在仓库文件里。
            </p>
          </div>
        </div>
        <StudySettings />
      </main>
    </>
  )
}
