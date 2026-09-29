'use client';
export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    cache: 'no-store',
    ...opts,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }
  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error || `请求失败 (${res.status})`);
  }
  return data;
}
