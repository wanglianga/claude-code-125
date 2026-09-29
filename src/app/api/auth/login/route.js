import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { one } from '../../../../lib/db';
import { createSession, ROLE_HOME } from '../../../../lib/session';

// POST /api/auth/login  { username, password }
export async function POST(req) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: '请输入账号和密码' }, { status: 400 });
    }
    const user = await one('SELECT * FROM users WHERE username = ?', [String(username).trim()]);
    if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
      return NextResponse.json({ ok: false, error: '账号或密码错误' }, { status: 401 });
    }
    await createSession(user);
    return NextResponse.json({ ok: true, role: user.role, home: ROLE_HOME[user.role] || '/' });
  } catch (e) {
    return NextResponse.json({ ok: false, error: '登录失败：' + e.message }, { status: 500 });
  }
}
