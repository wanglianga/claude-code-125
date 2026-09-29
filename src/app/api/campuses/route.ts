import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { api, ok } from '@/lib/api';

export const GET = api(async (_req, _b, user) => {
  const rows = await query(
    `SELECT c.*, (SELECT COUNT(*) FROM grades g WHERE g.campus_id=c.id) grade_count
     FROM campuses c ORDER BY c.id`,
  );
  return ok({ campuses: rows });
});

export const POST = api(async (_req: NextRequest, body: any, user) => {
  const r = await query('INSERT INTO campuses (name) VALUES (?)', [body.name]);
  return ok({ id: (r as any).insertId });
}, ['admin', 'general_affairs']);
