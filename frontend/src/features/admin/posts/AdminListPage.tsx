import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AdminTopbar } from '../AdminTopbar'
import { AdminToast, type AdminNotice } from '../AdminToast'
import { createPost, deletePost, listAdminPosts } from '../api'
import { errorMessage } from '@/shared/api/client'
import { AdminPostTable, type AdminRow } from './AdminPostTable'
import { AdminStatsRow } from './AdminStatsRow'
import { NewPostModal } from './NewPostModal'

type Tab = 'all' | 'posts' | 'drafts'

const TABS = [
  ['all', '全部'],
  ['posts', '已发布'],
  ['drafts', '草稿'],
] as const

export default function AdminListPage() {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('all')
  const [keyword, setKeyword] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState<AdminNotice | null>(null)

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

  const categories = new Set(rows.flatMap((row) => row.categories))

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['admin', 'posts'] })
    await client.invalidateQueries({ queryKey: ['posts'] })
  }

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

  const remove = async (kind: AdminRow['kind'], slug: string) => {
    if (!window.confirm(`删除「${slug}」？文件会移入 .trash/。`)) return
    setBusy(slug)
    try {
      await deletePost(kind, slug)
      setNotice({ tone: 'success', text: '已移入 .trash/' })
      await refresh()
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
          rows={rows}
          loading={isLoading}
          busy={busy}
          onRemove={(kind, slug) => void remove(kind, slug)}
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
