import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { api, ok, logActivity } from '@/lib/api';

// 班主任查看/组织本班试穿时段；总务看全部
export const GET = api(async (req: NextRequest, _b: any, user) => {
  const sp = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: any[] = [];
  if (sp.get('plan_id')) { where.push('fs.plan_id=?'); params.push(sp.get('plan_id')); }
  if (user.role === 'head_teacher') { where.push('c.teacher_user_id=?'); params.push(user.id); }
  const rows = await query(
    `SELECT fs.*, c.name class_name, cp.name campus_name, u.real_name organizer_name,
            (SELECT COUNT(*) FROM fitting_records fr WHERE fr.session_id=fs.id) recorded,
            (SELECT COUNT(*) FROM students s WHERE s.class_id=fs.class_id AND s.status='active') student_count
     FROM fitting_sessions fs
     JOIN classes c ON c.id=fs.class_id
     JOIN grades g ON g.id=c.grade_id
     JOIN campuses cp ON cp.id=g.campus_id
     LEFT JOIN users u ON u.id=fs.organizer_user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY fs.start_time`, params);
  return ok({ sessions: rows });
});

// 班主任安排试穿时段
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const r = await query(
    `INSERT INTO fitting_sessions (plan_id,class_id,start_time,end_time,location,organizer_user_id)
     VALUES (?,?,?,?,?,?)`,
    [body.plan_id, body.class_id, body.start_time, body.end_time, body.location, user.id]);
  const id = (r as any).insertId;
  await logActivity({ actor: user, action: '安排试穿时段', detail: `${body.start_time} @ ${body.location}` });
  return ok({ id });
}, ['head_teacher', 'admin', 'general_affairs']);
