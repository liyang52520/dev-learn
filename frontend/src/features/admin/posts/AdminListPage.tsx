import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AdminTopbar } from '../AdminTopbar'
import { AdminToast, type AdminNotice } from '../AdminToast'
import { createPost, listAdminPosts } from '../api'
import { errorMessage } from '@/shared/api/client'
import { AdminPager } from './AdminPager'
import { AdminPostTable, type AdminRow } from './AdminPostTable'
import { AdminStatsRow } from './AdminStatsRow'
import { NewPostModal } from './NewPostModal'
import { usePostListActions } from './usePostListActions'

type Tab = 'all' | 'posts' | 'drafts'

const PAGE_SIZE = 10

const TABS = [
  ['all', '全部'],
  ['posts', '已发布'],
  ['drafts', '草稿'],
] as const

export default function AdminListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [notice, setNotice] = useState<AdminNotice | null>(null)
  const { busy, setBusy, refresh, togglePublish, remove } = usePostListActions(setNotice)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'posts', keyword],
    queryFn: () => listAdminPosts('', keyword),
  })

  const rows: AdminRow[] = [
    ...(data?.posts ?? []).map((post) => ({ ...post, kind: 'posts' as const })),
    ...(data?.drafts ?? []).map((post) => ({ ...post, kind: 'drafts' as const })),
  ]
    .filter((row) => tab === 'all' || row.kind === tab)
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [tab, keyword])

  const categories = new Set(rows.flatMap((row) => row.categories))

  const create = async () => {
    if (!title.trim()) return
    setBusy('create')
    try {
      const post = await createPost(title.trim())
      await refresh()
      navigate(`/admin/edit/drafts/${encodeURIComponent(post.meta.slug)}`)
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="admin-root">
      <AdminTopbar />
      <div className="admin-page">
        <div className="admin-page-head">
          <div>
            <p className="admin-kicker">CONTENT STUDIO</p>
            <h1>文章管理</h1>
            <p className="admin-lede">草稿、发布与编辑都在本地 Markdown 文件上完成。</p>
          </div>
          <div className="admin-head-actions">
            <button type="button" className="admin-button" onClick={() => void refresh()}>
              刷新
            </button>
            <button type="button" className="admin-button primary" onClick={() => setNewOpen(true)}>
              新建文章
            </button>
          </div>
        </div>

        <AdminStatsRow
          posts={data?.posts.length}
          drafts={data?.drafts.length}
          categories={categories.size}
        />

        <div className="admin-toolbar">
          <div className="admin-tabs">
            {TABS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={tab === value ? 'active' : ''}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="admin-search">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题、标签、分类…"
              aria-label="搜索文章"
            />
          </div>
        </div>

        <AdminPostTable
          rows={pagedRows}
          loading={isLoading}
          busy={busy}
          onTogglePublish={(kind, slug) => void togglePublish(kind, slug)}
          onRemove={(kind, slug) => void remove(kind, slug)}
        />

        <AdminPager
          page={currentPage}
          pageCount={pageCount}
          total={rows.length}
          onChange={setPage}
        />
      </div>

      {newOpen && (
        <NewPostModal
          title={title}
          busy={busy === 'create'}
          onTitleChange={setTitle}
          onClose={() => setNewOpen(false)}
          onCreate={() => void create()}
        />
      )}

      <AdminToast notice={notice} onClose={() => setNotice(null)} />
    </div>
  )
}
