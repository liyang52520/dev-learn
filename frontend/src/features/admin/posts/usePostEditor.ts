import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  deletePost,
  fetchRawPost,
  previewMarkdown,
  publishPost,
  savePost,
  unpublishPost,
  uploadImage,
} from '../api'
import { errorMessage } from '@/shared/api/client'
import type { FrontMatter } from '@/types/models'

const EMPTY: FrontMatter = {
  title: '',
  date: '',
  tags: [],
  categories: [],
  description: '',
  cover: '',
}

export type EditorMode = 'edit' | 'preview'

export function usePostEditor(type: string, slug: string) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'raw', type, slug],
    queryFn: () => fetchRawPost(type, slug),
    enabled: slug.length > 0,
  })

  const [front, setFront] = useState<FrontMatter>(EMPTY)
  const [body, setBody] = useState('')
  const [ready, setReady] = useState(false)
  const [preview, setPreview] = useState('')
  const [mode, setMode] = useState<EditorMode>('edit')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const insertRef = useRef<((text: string) => void) | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!data) return
    setFront(data.post.front)
    setBody(data.post.body)
    setReady(true)
  }, [data])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      previewMarkdown(body)
        .then((result) => setPreview(result.html))
        .catch(() => setPreview('<p>预览生成失败。</p>'))
    }, 260)
    return () => window.clearTimeout(timer)
  }, [body, ready])

  const update = (patch: Partial<FrontMatter>) => setFront((value) => ({ ...value, ...patch }))

  const save = async (nextType = type, nextSlug = slug): Promise<boolean> => {
    setBusy('save')
    setNotice('')
    try {
      await savePost(nextType, nextSlug, front, body)
      // 保存后让「整页预览」重新读盘，避免命中旧的 raw 缓存。
      await queryClient.invalidateQueries({ queryKey: ['admin', 'raw', nextType, nextSlug] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'posts'] })
      setNotice('已保存')
      return true
    } catch (err) {
      setNotice(errorMessage(err))
      return false
    } finally {
      setBusy('')
    }
  }

  const togglePublish = async () => {
    setBusy('publish')
    try {
      if (!(await save())) return
      const result = type === 'drafts' ? await publishPost(type, slug) : await unpublishPost(type, slug)
      navigate(`/admin/edit/${result.type}/${encodeURIComponent(result.slug)}`, { replace: true })
    } catch (err) {
      setNotice(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    if (!window.confirm(`删除「${front.title || slug}」？文件会移入 .trash/。`)) return
    setBusy('delete')
    try {
      await deletePost(type, slug)
      navigate('/admin', { replace: true })
    } catch (err) {
      setNotice(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  const upload = async (file: File) => {
    setBusy('upload')
    try {
      const result = await uploadImage(file)
      const text = `\n![${file.name}](${result.url})\n`
      if (insertRef.current) insertRef.current(text)
      else setBody((value) => value + text)
      setNotice(`已上传：${result.url}`)
    } catch (err) {
      setNotice(errorMessage(err))
    } finally {
      setBusy('')
    }
  }

  return {
    data,
    error,
    isPending,
    front,
    body,
    setBody,
    ready,
    preview,
    mode,
    setMode,
    notice,
    busy,
    insertRef,
    uploadRef,
    update,
    save,
    togglePublish,
    remove,
    upload,
  }
}
