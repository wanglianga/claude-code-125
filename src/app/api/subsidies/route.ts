import { NextRequest } from 'next/server';
import { query, one } from '@/lib/db';
import { api, ok, fail, logActivity } from '@/lib/api';

export const GET = api(async (req: NextRequest) => {
  const rows = await query(
    `SELECT sb.*, s.name student_name, s.student_no, c.name class_name, u.real_name approver_name
     FROM subsidies sb
     JOIN students s ON s.id=sb.student_id
     JOIN classes c ON c.id=s.class_id
     LEFT JOIN users u ON u.id=sb.approved_by
     ORDER BY sb.id DESC`);
  return ok({ subsidies: rows });
});

// 家长/总务为学生申请贫困生减免
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const s = await one<any>('SELECT * FROM students WHERE id=?', [body.student_id]);
  if (!s) return fail('学生不存在', 404);
  if (user.role === 'parent' && s.parent_user_id !== user.id) return fail('无权限', 403);
  const exist = await one('SELECT id FROM subsidies WHERE student_id=?', [body.student_id]);
  if (exist) return fail('该生已有减免申请');
  const r = await query(
    'INSERT INTO subsidies (student_id, ratio, reason, status) VALUES (?,?,?,?)',
    [body.student_id, body.ratio, body.reason || '贫困生减免', 'pending']);
  await logActivity({ student_id: s.id, actor: user, action: '申请贫困生减免', detail: `比例 ${body.ratio}` });
  return ok({ id: (r as any).insertId });
});

// 总务审批
export const PATCH = api(async (_req: NextRequest, body: any, user) => {
  const sb = await one<any>('SELECT * FROM subsidies WHERE id=?', [body.id]);
  if (!sb) return fail('申请不存在', 404);
  await query('UPDATE subsidies SET status=?, approved_by=? WHERE id=?',
    [body.status, user.id, body.id]);
  await logActivity({ student_id: sb.student_id, actor: user, action: '减免审批', detail: body.status === 'approved' ? `批准，比例${sb.ratio}` : '驳回' });
  return ok();
}, ['admin', 'general_affairs']);
