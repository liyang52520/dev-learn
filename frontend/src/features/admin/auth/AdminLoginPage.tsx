import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { fetchMe, login, setupPassword } from '../../admin/api'
import { errorMessage } from '@/shared/api/client'
import { BrandMark } from '@/shared/components/BrandMark'
import { PageSkeleton } from '@/shared/components/PageSkeleton'

type LoginState = { from?: string }

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const client = useQueryClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: me, isPending } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: fetchMe,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const setupMode = me?.needsSetup === true

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (setupMode && password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (setupMode) {
        await setupPassword(password)
      } else {
        await login(password)
      }
      client.setQueryData(['admin', 'me'], { authenticated: true, needsSetup: false })
      const from = (location.state as LoginState | null)?.from
      const target =
        from && from.startsWith('/') && !from.startsWith('/admin/login') ? from : '/'
      navigate(target, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (isPending) return <PageSkeleton />

  return (
    <div className="login-page">
      <div className="login-poster">
        <div className="login-poster-inner">
          <BrandMark className="login-mark" />
          <p className="login-kicker">PRIVATE SPACE</p>
          <h1>
            回到
            <br />
            你的站点。
          </h1>
          <p className="login-quote">博客、题库与复习进度都在这里，只对一个人开放。</p>
          <div className="login-poster-foot">
            <span>博客</span>
            <span>题库</span>
            <span>复习</span>
          </div>
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <p className="login-kicker dark">{setupMode ? 'FIRST RUN' : 'SIGN IN'}</p>
          <h2>{setupMode ? '设置访问密码' : '进入站点'}</h2>
          <p className="login-sub">
            {setupMode ? '第一次进入系统，先设置一个只属于你的访问密码。' : '输入访问密码后继续。'}
          </p>
          <label>
            访问密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={setupMode ? '至少 8 位' : '请输入密码'}
              autoFocus
              autoComplete={setupMode ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {setupMode && (
            <label>
              确认密码
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="再输入一次"
                autoComplete="new-password"
                required
              />
            </label>
          )}
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="admin-button primary" disabled={busy}>
            {busy ? (setupMode ? '设置中…' : '登录中…') : setupMode ? '设置并进入' : '登录'}
          </button>
          <p className="login-note">
            {setupMode
              ? '密码至少 8 位，设置后登录状态保留 7 天。'
              : '仅限本人使用，登录状态会保留 7 天。'}
          </p>
        </form>
      </div>
    </div>
  )
}
