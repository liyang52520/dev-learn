import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { login } from '../../admin/api'
import { errorMessage } from '@/shared/api/client'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(password)
      navigate('/admin', { replace: true })
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
          <p className="login-kicker">WRITING STUDIO</p>
          <h1>
            把想法
            <br />
            写成文章。
          </h1>
          <p className="login-quote">写作是思考的慢动作。草稿、编辑、发布，都在这里完成。</p>
          <div className="login-poster-foot">
            <span>42 个学习专题</span>
            <span>2521 道面试题</span>
            <span>本地文件优先</span>
          </div>
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <p className="login-kicker dark">SIGN IN</p>
          <h2>进入写作台</h2>
          <p className="login-sub">输入管理密码后继续。</p>
          <label>
            管理密码
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
          <Link to="/" className="login-back">
            ← 返回博客
          </Link>
        </form>
      </div>
    </div>
  )
}
