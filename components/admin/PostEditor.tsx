'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import type { PostMeta, PostType } from '@/lib/types';
import { IconArrow } from '@/components/Icons';

interface Front {
  title: string;
  date: string;
  tags: string[];
  categories: string[];
  description: string;
  cover: string;
}

interface InitialPost {
  meta: PostMeta;
  front: Front;
  body: string;
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PostEditor({ type, initial }: { type: PostType; initial: InitialPost }) {
  const router = useRouter();
  const [kind, setKind] = useState<PostType>(type);
  const [slug, setSlug] = useState(initial.meta.slug);
  const [title, setTitle] = useState(initial.front.title);
  const [date, setDate] = useState(initial.front.date);
  const [tags, setTags] = useState(initial.front.tags.join(', '));
  const [categories, setCategories] = useState(initial.front.categories.join(', '));
  const [description, setDescription] = useState(initial.front.description);
  const [cover, setCover] = useState(initial.front.cover);
  const [body, setBody] = useState(initial.body);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef(initial.body);

  useEffect(() => {
    if (!hostRef.current) return;
    const dark = document.documentElement.classList.contains('dark');
    const view = new EditorView({
      doc: bodyRef.current,
      parent: hostRef.current,
      extensions: [
        basicSetup,
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            bodyRef.current = update.state.doc.toString();
            setBody(bodyRef.current);
            setDirty(true);
            setNotice('');
          }
        }),
        ...(dark ? [oneDark] : []),
      ],
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (mode !== 'preview') return;
    viewRef.current?.requestMeasure();
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/admin/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: bodyRef.current }),
        });
        const data = await res.json();
        setPreviewHtml(data.html || '');
      } catch {
        setPreviewHtml('<p>预览生成失败。</p>');
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mode, body]);

  async function save() {
    if (!title.trim()) {
      setNotice('标题不能为空');
      return false;
    }
    setSaving(true);
    setNotice('');
    try {
      const res = await fetch('/api/admin/post', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: kind,
          slug,
          front: {
            title,
            date,
            tags: splitList(tags),
            categories: splitList(categories),
            description,
            cover,
          },
          body: bodyRef.current,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '保存失败');
      }
      setDirty(false);
      setNotice('已保存');
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    const ok = await save();
    if (!ok) return;
    const direction = kind === 'drafts' ? 'publish' : 'unpublish';
    setSaving(true);
    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, direction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '操作失败');
      setKind(data.type);
      setSlug(data.slug);
      setDirty(false);
      setNotice(direction === 'publish' ? '已发布' : '已撤回为草稿');
      window.history.replaceState(null, '', `/admin/edit/${data.type}/${encodeURIComponent(data.slug)}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`确定删除「${title}」吗？文件会移动到 .trash。`)) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/post?type=${kind}&slug=${encodeURIComponent(slug)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('删除失败');
      router.push('/admin');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '删除失败');
      setSaving(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setNotice('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      const snippet = `![${file.name}](${data.url})`;
      const view = viewRef.current;
      if (view) {
        const pos = view.state.selection.main.head;
        view.dispatch({
          changes: { from: pos, insert: snippet },
          selection: { anchor: pos + snippet.length },
        });
      }
      setNotice('图片已插入光标处');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '上传失败');
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const wordCount = bodyRef.current.length;
  const publishLabel = kind === 'drafts' ? '发布' : '撤回为草稿';

  return (
    <div className="admin-editor-page">
      <header className="editor-topbar">
        <Link href="/admin" className="editor-back">
          ← 返回列表
        </Link>
        <div className="editor-title-wrap">
          <span className={`admin-badge ${kind}`}>{kind === 'drafts' ? '草稿' : '已发布'}</span>
          <strong>{title || '未命名文章'}</strong>
        </div>
        <div className="editor-actions">
          <a
            className="admin-button ghost"
            href={`/admin/preview/${kind}/${encodeURIComponent(slug)}`}
            target="_blank"
            rel="noreferrer"
          >
            整页预览
          </a>
          <button type="button" className="admin-button" onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" className="admin-button primary" onClick={togglePublish} disabled={saving}>
            {publishLabel}
          </button>
          <button type="button" className="admin-button danger" onClick={remove} disabled={saving}>
            删除
          </button>
        </div>
      </header>

      {notice && <div className="editor-notice">{notice}</div>}

      <div className="editor-layout">
        <aside className="editor-meta">
          <p className="editor-panel-title">文章信息</p>
          <label className="admin-field">
            标题
            <input value={title} onChange={(event) => { setTitle(event.target.value); setDirty(true); }} />
          </label>
          <label className="admin-field">
            日期
            <input value={date} onChange={(event) => { setDate(event.target.value); setDirty(true); }} placeholder="2026-08-26 13:51:15" />
          </label>
          <label className="admin-field">
            标签
            <input value={tags} onChange={(event) => { setTags(event.target.value); setDirty(true); }} placeholder="Spring, Java" />
            <small>英文逗号分隔</small>
          </label>
          <label className="admin-field">
            分类
            <input value={categories} onChange={(event) => { setCategories(event.target.value); setDirty(true); }} placeholder="后端" />
          </label>
          <label className="admin-field">
            摘要
            <textarea
              value={description}
              onChange={(event) => { setDescription(event.target.value); setDirty(true); }}
              rows={3}
              placeholder="可选，用于首页与搜索结果"
            />
          </label>
          <label className="admin-field">
            封面图
            <input value={cover} onChange={(event) => { setCover(event.target.value); setDirty(true); }} placeholder="/images/cover.jpg" />
          </label>

          <div className="editor-meta-foot">
            <span>文件</span>
            <code>content/{kind}/{slug}.md</code>
          </div>
        </aside>

        <main className="editor-main">
          <div className="editor-toolbar">
            <div className="editor-modes">
              <button type="button" className={mode === 'edit' ? 'active' : ''} onClick={() => setMode('edit')}>
                Markdown
              </button>
              <button type="button" className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}>
                预览
              </button>
            </div>
            <div className="editor-tools">
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              <button type="button" className="admin-button small" onClick={() => uploadRef.current?.click()} disabled={uploading}>
                {uploading ? '上传中…' : '插入图片'}
              </button>
              <span className="editor-shortcut">⌘S 保存</span>
            </div>
          </div>

          <div className={mode === 'preview' ? 'editor-body is-preview' : 'editor-body'}>
            <div className="cm-host" ref={hostRef} />
            <div className="editor-preview-pane">
              {previewLoading ? (
                <p className="editor-preview-status">正在生成预览…</p>
              ) : (
                <div className="prose" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              )}
            </div>
          </div>

          <footer className="editor-statusbar">
            <span>{dirty ? '有未保存修改' : '已保存'}</span>
            <span>{wordCount.toLocaleString('en-US')} 字符</span>
            <span>Markdown · Front Matter 保留</span>
            <span className="editor-status-right">{slug}.md</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
