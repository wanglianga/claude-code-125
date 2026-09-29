import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { api, ok } from '@/lib/api';

export const GET = api(async (req: NextRequest) => {
  const campusId = req.nextUrl.searchParams.get('campus_id');
  const rows = await query(
    `SELECT g.*, c.name campus_name FROM grades g JOIN campuses c ON c.id=g.campus_id
     ${campusId ? 'WHERE g.campus_id=?' : ''} ORDER BY g.id`,
    campusId ? [campusId] : [],
  );
  return ok({ grades: rows });
});

export const POST = api(async (_req: NextRequest, body: any) => {
  const r = await query('INSERT INTO grades (campus_id, name, graduation_year) VALUES (?,?,?)',
    [body.campus_id, body.name, body.graduation_year || null]);
  return ok({ id: (r as any).insertId });
}, ['admin', 'general_affairs']);
