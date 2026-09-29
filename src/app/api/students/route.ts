import { NextRequest } from 'next/server';
import { query, one } from '@/lib/db';
import { api, ok, fail, logActivity } from '@/lib/api';

// 学生列表：总务看全校/校区，班主任看本班，家长看自己孩子
export const GET = api(async (req: NextRequest, _b: any, user) => {
  const sp = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: any[] = [];
  if (user.role === 'parent') {
    where.push('s.parent_user_id=?');
    params.push(user.id);
  } else if (user.role === 'head_teacher') {
    where.push('c.teacher_user_id=?');
    params.push(user.id);
  } else if (user.campus_id) {
    where.push('s.campus_id=?');
    params.push(user.campus_id);
  }
  if (sp.get('class_id')) { where.push('s.class_id=?'); params.push(sp.get('class_id')); }
  if (sp.get('q')) { where.push('(s.name LIKE ? OR s.student_no LIKE ?)'); params.push(`%${sp.get('q')}%`, `%${sp.get('q')}%`); }
  const rows = await query(
    `SELECT s.*, c.name class_name, g.name grade_name, cp.name campus_name,
            u.real_name parent_name,
            (SELECT CONCAT(ratio,':',status) FROM subsidies sb WHERE sb.student_id=s.id) subsidy
     FROM students s
     JOIN classes c ON c.id=s.class_id
     JOIN grades g ON g.id=s.grade_id
     JOIN campuses cp ON cp.id=s.campus_id
     LEFT JOIN users u ON u.id=s.parent_user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY s.id`, params);
  return ok({ students: rows });
});

// 新增/更新学生（总务）
export const POST = api(async (_req: NextRequest, body: any) => {
  if (body.id) {
    await query(
      `UPDATE students SET name=?,class_id=?,grade_id=?,campus_id=?,parent_user_id=?,
       height_cm=?,weight_kg=?,usual_size=?,special_fit=?,special_fit_note=? WHERE id=?`,
      [body.name, body.class_id, body.grade_id, body.campus_id, body.parent_user_id || null,
       body.height_cm || null, body.weight_kg || null, body.usual_size || null,
       body.special_fit ? 1 : 0, body.special_fit_note || null, body.id]);
    return ok({ id: body.id });
  }
  const r = await query(
    `INSERT INTO students (student_no,name,campus_id,grade_id,class_id,parent_user_id,height_cm,weight_kg,usual_size,special_fit,special_fit_note)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [body.student_no, body.name, body.campus_id, body.grade_id, body.class_id, body.parent_user_id || null,
     body.height_cm || null, body.weight_kg || null, body.usual_size || null,
     body.special_fit ? 1 : 0, body.special_fit_note || null]);
  return ok({ id: (r as any).insertId });
}, ['admin', 'general_affairs']);

// 家长更新孩子的身高体重/常穿尺码/特殊版型
export const PATCH = api(async (_req: NextRequest, body: any, user) => {
  const s = await one<any>('SELECT * FROM students WHERE id=?', [body.student_id]);
  if (!s) return fail('学生不存在', 404);
  if (user.role === 'parent' && s.parent_user_id !== user.id) return fail('只能维护自己孩子的信息', 403);
  await query(
    `UPDATE students SET height_cm=?,weight_kg=?,usual_size=?,special_fit=?,special_fit_note=? WHERE id=?`,
    [body.height_cm ?? null, body.weight_kg ?? null, body.usual_size || null,
     body.special_fit ? 1 : 0, body.special_fit_note || null, body.student_id]);
  await logActivity({ student_id: s.id, actor: user, action: '更新学生尺码信息', detail: `身高${body.height_cm}cm 体重${body.weight_kg}kg 常穿${body.usual_size || '-'}` });
  return ok();
});

// 转学：标记学生状态，进行中订单挂起并生成售后工单（由调用方/工单接口处理订单）
