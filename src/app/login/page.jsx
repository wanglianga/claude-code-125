'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fd = new FormData(e.target);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || '登录失败');
        setLoading(false);
        return;
      }
      router.push(data.home || '/');
      router.refresh();
    } catch (err) {
      setError('网络错误，请重试');
      setLoading(false);
    }
  }

  return (
    <div className="login-hero">
      <div className="login-card">
        <h1>校服订购与售后平台</h1>
        <div className="sub">订购 · 试穿 · 生产 · 发放 · 换码 · 售后 一体化</div>
        {error && <div className="login-err">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>账号</label>
            <input name="username" required autoFocus placeholder="请输入账号" />
          </div>
          <div className="field">
            <label>密码</label>
            <input name="password" type="password" required placeholder="请输入密码" />
          </div>
          <button className="btn" disabled={loading}>{loading ? '登录中…' : '登 录'}</button>
        </form>
        <div className="demo-accounts">
          <b>演示账号（密码均为 123456）</b><br />
          总务 <code>admin</code> · 班主任 <code>wang</code> / <code>li</code> · 家长 <code>parent1</code>~<code>parent13</code><br />
          供应商 <code>supplier1</code> · 工厂 <code>factory1</code> · 售后客服 <code>service1</code>
        </div>
      </div>
    </div>
  );
}
