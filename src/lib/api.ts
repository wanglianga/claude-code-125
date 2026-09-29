import { NextRequest } from 'next/server';
import { requireUser, SessionUser } from './auth';

export function ok(data: any = {}) {
  return Response.json({ ok: true, ...data });
}

export function fail(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

type Handler = (req: NextRequest, body: any, user: SessionUser, ctx: { params: any }) => Promise<Response>;

export function api(handler: Handler, roles?: string[]) {
  return async (req: NextRequest, routeCtx: any) => {
    try {
      const user = await requireUser(roles);
      let body: any = {};
      if (req.method !== 'GET' && req.method !== 'DELETE') {
        try {
          body = await req.json();
        } catch {
          body = {};
        }
      }
      return await handler(req, body, user, { params: routeCtx?.params ?? {} });
    } catch (e: any) {
      const status = e.status || 500;
      if (status >= 500) console.error('[api error]', e);
      return fail(e.message || '服务器错误', status);
    }
  };
}

export async function logActivity(opts: {
  student_id?: number | null;
  order_id?: number | null;
  actor: SessionUser;
  action: string;
  detail?: string;
}) {
  const { query } = await import('./db');
  await query(
    'INSERT INTO activity_log (student_id, order_id, actor_role, actor_name, action, detail) VALUES (?,?,?,?,?,?)',
    [
      opts.student_id ?? null,
      opts.order_id ?? null,
      opts.actor.role,
      opts.actor.real_name,
      opts.action,
      opts.detail ?? null,
    ],
  );
}

export function genNo(prefix: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${rand}`;
}
