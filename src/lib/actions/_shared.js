import { redirect } from 'next/navigation';

// 表单提交后统一回跳并携带提示
export function back(path, key, msg) {
  const sep = String(path).includes('?') ? '&' : '?';
  redirect(`${path}${sep}${key}=${encodeURIComponent(msg)}`);
}
export const ok = (path, msg) => back(path, 'ok', msg);
export const fail = (path, msg) => back(path, 'error', msg);

export function str(v, max = 255) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
