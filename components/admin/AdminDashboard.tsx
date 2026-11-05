'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { PostMeta } from '@/lib/types';
import { IconClose, IconSearch } from '@/components/Icons';

type Tab = 'all' | 'posts' | 'drafts';

interface Row extends PostMeta {
  kind: 'posts' | 'drafts';
}

export default function AdminDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  async function load(options: { silent?: boolean } = {}) {
    if (!options.silent) setLoading(true);
    try {
      const res = await fetch('/api/admin/posts');
      const data = await res.json();
      setRows([
        ...(data.posts || []).map((post: PostMeta) => ({ ...post, kind: 'posts' as const })),
        ...(data.drafts || []).map((post: PostMeta) => ({ ...post, kind: 'drafts' as const })),
      ]);
    } catch {
      setNotice('加载失败，请刷新重试');
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows
      .filter((row) => (tab === 'all' ? true : row.kind === tab))
      .filter((row) =>
        keyword
          ? `${row.title} ${row.tags.join(' ')} ${row.categories.join(' ')}`.toLowerCase().includes(keyword)
          : true,
      )
      .sort((a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime());
  }, [rows, tab, query]);

  const published = rows.filter((row) => row.kind === 'posts').length;
  const drafts = rows.filter((row) => row.kind === 'drafts').length;

  async function togglePublish(row: Row) {
    const direction = row.kind === 'drafts' ? 'publish' : 'unpublish';
    setBusy(row.slug);
    setNotice('');
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: row.slug, direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setNotice(direction === 'publish' ? '已发布' : '已撤回为草稿');
      await load({ silent: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy('');
    }
  }

  async function remove(row: Row) {
    if (!confirm(`确定删除「${row.title}」吗？文件会移动到 .trash。`)) return;
    setBusy(row.slug);
    setNotice('');
    try {
      const res = await fetch(
        `/api/admin/post?type=${row.kind}&slug=${encodeURIComponent(row.slug)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('删除失败');
      setNotice('已移入 .trash');
      await load({ silent: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除失败');
    } finally {
      setBusy('');
    }
  }

  async function create() {
    if (!newTitle.trim()) return;
    setBusy('create');
    setNotice('');
    try {
      const res = await fetch('/api/admin/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建失败');
      router.push(`/admin/edit/drafts/${encodeURIComponent(data.post.meta.slug)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '创建失败');
      setBusy('');
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page-head">
        <div>
          <p className="admin-kicker">CONTENT STUDIO</p>
          <h1>内容管理</h1>
          <p className="admin-lede">草稿、发布与编辑都在本地 Markdown 文件上完成。</p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="admin-button" onClick={() => load()} disabled={loading}>
            刷新
          </button>
          <button type="button" className="admin-button primary" onClick={() => setNewOpen(true)}>
            + 新建文章
          </button>
        </div>
      </header>

      <div className="admin-stats">
        <div>
          <span>已发布</span>
          <strong>{published}</strong>
        </div>
        <div>
          <span>草稿</span>
          <strong>{drafts}</strong>
        </div>
        <div>
          <span>全部</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="admin-stats-note">
          <span>存储位置</span>
          <code>content/posts · content/drafts</code>
        </div>
      </div>

      {notice && <div className="admin-notice">{notice}</div>}

      <div className="admin-toolbar">
        <div className="admin-tabs">
          {(
            [
              ['all', `全部 ${rows.length}`],
              ['posts', `已发布 ${published}`],
              ['drafts', `草稿 ${drafts}`],
            ] as const
          ).map(([value, label]) => (
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
          <IconSearch size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、分类、标签…"
          />
        </div>
      </div>

      <div className="admin-table">
        <div className="admin-table-head">
          <span>状态</span>
          <span>标题</span>
          <span>日期</span>
          <span>分类 / 标签</span>
          <span>操作</span>
        </div>
        {loading ? (
          <div className="admin-table-empty">正在加载…</div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">没有匹配的文章。</div>
        ) : (
          filtered.map((row) => (
            <div className="admin-row" key={`${row.kind}-${row.slug}`}>
              <span className={`admin-badge ${row.kind}`}>
                {row.kind === 'posts' ? '已发布' : '草稿'}
              </span>
              <Link href={`/admin/edit/${row.kind}/${encodeURIComponent(row.slug)}`} className="admin-row-title">
                {row.title}
                {row.excerpt && <small>{row.excerpt}</small>}
              </Link>
              <span className="admin-row-date">{row.displayDate}</span>
              <span className="admin-row-tax">
                {row.categories.length > 0 && <span className="admin-row-cats">{row.categories.join(' / ')}</span>}
                {row.tags.length > 0 && (
                  <span className="admin-row-tags">{row.tags.slice(0, 3).map((tag) => `#${tag}`).join(' ')}</span>
                )}
                {row.categories.length === 0 && row.tags.length === 0 && <span className="admin-row-tags">—</span>}
              </span>
              <span className="admin-row-actions">
                <Link href={`/admin/edit/${row.kind}/${encodeURIComponent(row.slug)}`}>编辑</Link>
                <button type="button" onClick={() => togglePublish(row)} disabled={busy === row.slug}>
                  {row.kind === 'drafts' ? '发布' : '撤回'}
                </button>
                <button type="button" className="danger" onClick={() => remove(row)} disabled={busy === row.slug}>
                  删除
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {newOpen && (
        <div className="admin-modal-overlay" onMouseDown={() => setNewOpen(false)}>
          <div className="admin-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>新建草稿</h2>
              <button type="button" className="icon-button" onClick={() => setNewOpen(false)} aria-label="关闭">
                <IconClose />
              </button>
            </div>
            <label className="admin-field">
              文章标题
              <input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="例如：Spring Boot 自动配置原理"
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === 'Enter') create();
                }}
              />
            </label>
            <p className="admin-modal-hint">创建后会写入 content/drafts，随后进入编辑器。</p>
            <div className="admin-modal-actions">
              <button type="button" className="admin-button" onClick={() => setNewOpen(false)}>
                取消
              </button>
              <button type="button" className="admin-button primary" onClick={create} disabled={busy === 'create'}>
                创建并编辑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
