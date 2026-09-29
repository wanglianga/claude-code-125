'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/fetch';

const ACCOUNTS = [
  ['zw', '学校总务'], ['wangls', '班主任(一1班)'], ['chen_ma', '家长·陈晓'],
  ['lin_ba', '家长·林小雨(未缴费)'], ['he_ma', '家长·何苗(换码/过敏)'], ['zhou_ma', '家长·周悦(转学)'],
  ['gys', '供应商'], ['gc', '工厂'], ['kf', '售后客服'], ['admin', '管理员'],
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('zw');
  const [password, setPassword] = useState('uniform123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true); setErr('');
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 420, margin: '70px auto' }}>
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontSize: 20 }}>🎽 校园校服订购与售后换码平台</h2>
        <p className="muted">尺码试穿 · 订购缴费 · 生产批次 · 分批发放 · 换码补发退款</p>
        <form onSubmit={login}>
          <div className="field">
            <label>用户名</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
          <button className="btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? '登录中…' : '登 录'}
          </button>
        </form>
        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0' }} />
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>测试账号（点击填充，密码统一 uniform123）：</div>
        <div className="pill-row">
          {ACCOUNTS.map(([u, label]) => (
            <button key={u} type="button" className="tag-chip" style={{ cursor: 'pointer', border: '1px solid var(--line)' }}
              onClick={() => { setUsername(u); setPassword('uniform123'); }}>
              {label} <span className="mono">{u}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
