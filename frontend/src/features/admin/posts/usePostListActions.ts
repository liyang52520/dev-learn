import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { deletePost, publishPost, unpublishPost } from '../api'
import { errorMessage } from '@/shared/api/client'
import type { AdminNotice } from '../AdminToast'

type Kind = 'posts' | 'drafts'

export function usePostListActions(onNotice: (notice: AdminNotice) => void) {
  const client = useQueryClient()
  const [busy, setBusy] = useState('')

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['admin', 'posts'] })
    await client.invalidateQueries({ queryKey: ['posts'] })
  }

  const run = async (slug: string, work: () => Promise<void>) => {
    setBusy(slug)
    try {
      await work()
      await refresh()
    } catch (error) {
      onNotice({ tone: 'error', text: errorMessage(error) })
    } finally {
      setBusy('')
    }
  }

  const togglePublish = (kind: Kind, slug: string) =>
    run(slug, async () => {
      const result = kind === 'drafts' ? await publishPost(kind, slug) : await unpublishPost(kind, slug)
      onNotice({ tone: 'success', text: result.type === 'posts' ? '已发布' : '已撤回为草稿' })
    })

  const remove = (kind: Kind, slug: string) => {
    if (!window.confirm(`删除「${slug}」？文件会移入 .trash/。`)) return
    return run(slug, async () => {
      await deletePost(kind, slug)
      onNotice({ tone: 'success', text: '已移入 .trash/' })
    })
  }

  return { busy, setBusy, refresh, togglePublish, remove }
}
