import crypto from 'crypto';
import { cookies } from 'next/headers';
import { one } from './db';

export interface SessionUser {
  id: number;
  username: string;
  real_name: string;
  role: string;
  campus_id: number | null;
  supplier_id: number | null;
}

const SECRET = process.env.SESSION_SECRET || 'uniform-platform-dev-secret';
const COOKIE = 'uniform_session';

export function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function sign(payload: string) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createToken(userId: number) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, t: Date.now() })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function parseToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expect = sign(payload);
  if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) {
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString()).uid;
    } catch {
      return null;
    }
  }
  return null;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE)?.value;
  const uid = parseToken(token);
  if (!uid) return null;
  return one<SessionUser>(
    'SELECT id, username, real_name, role, campus_id, supplier_id FROM users WHERE id=?',
    [uid],
  );
}

export async function requireUser(roles?: string[]): Promise<SessionUser> {
  const u = await currentUser();
  if (!u) throw Object.assign(new Error('未登录'), { status: 401 });
  if (roles && !roles.includes(u.role)) throw Object.assign(new Error('无权限'), { status: 403 });
  return u;
}

export function setSessionCookie(userId: number) {
  cookies().set(COOKIE, createToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

export const ROLE_LABELS: Record<string, string> = {
  admin: '系统管理员',
  general_affairs: '学校总务',
  head_teacher: '班主任',
  parent: '家长',
  supplier: '供应商',
  factory: '工厂',
  after_sales: '售后客服',
};
