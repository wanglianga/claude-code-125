import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one } from './db';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'uniform-dev-secret');
const COOKIE = 'uniform_session';

export async function createSession(user) {
  const token = await new SignJWT({ uid: user.id, role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

// 页面级守卫：未登录跳登录页；指定角色不符跳各自首页
export async function requireUser(roles) {
  const s = await getSession();
  if (!s) redirect('/login');
  if (roles && !roles.includes(s.role)) redirect('/');
  // 每次取最新用户信息（角色/班级可能变更）
  const user = await one('SELECT id, username, name, role, campus_id, supplier_id FROM users WHERE id = ?', [s.uid]);
  if (!user) redirect('/login');
  return user;
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export const ROLE_HOME = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  PARENT: '/parent',
  SUPPLIER: '/supplier',
  FACTORY: '/factory',
  SERVICE: '/service',
};
