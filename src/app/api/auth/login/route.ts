import { NextRequest } from 'next/server';
import { one } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';
import { ok, fail } from '@/lib/api';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) return fail('请输入用户名和密码');
  const u = await one<any>('SELECT * FROM users WHERE username=?', [username]);
  if (!u) return fail('用户名或密码错误', 401);
  const hash = hashPassword(password, u.salt);
  if (hash !== u.password_hash) return fail('用户名或密码错误', 401);
  setSessionCookie(u.id);
  return ok({ user: { id: u.id, username: u.username, real_name: u.real_name, role: u.role } });
}
