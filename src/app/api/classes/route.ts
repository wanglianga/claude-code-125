import { NextRequest } from 'next/server';
import { query, one } from '@/lib/db';
import { api, ok } from '@/lib/api';

export const GET = api(async (req: NextRequest) => {
  const gradeId = req.nextUrl.searchParams.get('grade_id');
  const rows = await query(
    `SELECT c.*, g.name grade_name, u.real_name teacher_name
     FROM classes c JOIN grades g ON g.id=c.grade_id
     LEFT JOIN users u ON u.id=c.teacher_user_id
     ${gradeId ? 'WHERE c.grade_id=?' : ''} ORDER BY c.id`,
    gradeId ? [gradeId] : [],
  );
  return ok({ classes: rows });
});

export const POST = api(async (_req: NextRequest, body: any) => {
  const r = await query('INSERT INTO classes (grade_id, name, teacher_user_id) VALUES (?,?,?)',
    [body.grade_id, body.name, body.teacher_user_id || null]);
  return ok({ id: (r as any).insertId });
}, ['admin', 'general_affairs']);
