'use client';

import { useState } from 'react';
import { withBasePath } from '@/lib/base-path';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(withBasePath('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '登录失败');
        setLoading(false);
        return;
      }
      window.location.href = withBasePath('/admin');
    } catch {
      setError('网络错误，请重试');
      setLoading(false);
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
        <form className="login-form" onSubmit={onSubmit}>
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
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="admin-button primary" disabled={loading}>
            {loading ? '登录中…' : '登录'}
          </button>
          <a href={withBasePath('/')} className="login-back">
            ← 返回博客
          </a>
        </form>
      </div>
    </div>
  );
}
