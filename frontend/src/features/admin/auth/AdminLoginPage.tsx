import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { login } from '../../admin/api'
import { errorMessage } from '@/shared/api/client'

type LoginState = { from?: string }

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const client = useQueryClient()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(password)
      client.setQueryData(['admin', 'me'], { authenticated: true })
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

  return (
    <div className="login-page">
      <div className="login-poster">
        <div className="login-poster-inner">
          <span className="login-mark">YG</span>
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
          <p className="login-kicker dark">SIGN IN</p>
          <h2>进入站点</h2>
          <p className="login-sub">输入访问密码后继续。</p>
          <label>
            访问密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
              autoFocus
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="admin-button primary" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </button>
          <p className="login-note">仅限本人使用，登录状态会保留 7 天。</p>
        </form>
      </div>
    </div>
  )
}
