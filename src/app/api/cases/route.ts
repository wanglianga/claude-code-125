import { NextRequest } from 'next/server';
import { query, one } from '@/lib/db';
import { api, ok, fail, logActivity, genNo } from '@/lib/api';

const TYPES = ['exchange', 'resend', 'refund', 'complaint', 'transfer_cancel', 'wrong_claim'];
const REASONS = ['growth', 'fitting_deviation', 'factory_missing', 'wrong_class_claim', 'allergy', 'late_payment', 'transfer', 'other'];

export const GET = api(async (req: NextRequest, _b: any, user) => {
  const sp = req.nextUrl.searchParams;
  const where: string[] = [];
  const params: any[] = [];
  if (user.role === 'parent') {
    where.push('s.parent_user_id=?'); params.push(user.id);
  }
  if (user.role === 'head_teacher') {
    where.push('c.teacher_user_id=?'); params.push(user.id);
  }
  if (user.role === 'supplier' || user.role === 'factory') {
    where.push('p.supplier_id=?'); params.push(user.supplier_id);
  }
  if (sp.get('status')) { where.push('ac.status=?'); params.push(sp.get('status')); }
  if (sp.get('student_id')) { where.push('ac.student_id=?'); params.push(sp.get('student_id')); }
  const rows = await query(
    `SELECT ac.*, s.name student_name, s.student_no, c.name class_name, cp.name campus_name,
            o.order_no, p.name plan_name,
            u.real_name creator_name, u2.real_name assignee_name
     FROM aftersales_cases ac
     JOIN students s ON s.id=ac.student_id
     JOIN classes c ON c.id=s.class_id
     JOIN campuses cp ON cp.id=s.campus_id
     LEFT JOIN orders o ON o.id=ac.order_id
     LEFT JOIN plans p ON p.id=o.plan_id
     LEFT JOIN users u ON u.id=ac.created_by
     LEFT JOIN users u2 ON u2.id=ac.assigned_to
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY ac.priority DESC, ac.id DESC`, params);
  return ok({ cases: rows });
});

// 家长/班主任/总务发起工单（换码、补发、退款、面料过敏投诉、错领等）
export const POST = api(async (_req: NextRequest, body: any, user) => {
  if (!TYPES.includes(body.type)) return fail('工单类型非法');
  if (!REASONS.includes(body.reason)) return fail('原因非法');
  const s = await one<any>('SELECT * FROM students WHERE id=?', [body.student_id]);
  if (!s) return fail('学生不存在', 404);
  if (user.role === 'parent' && s.parent_user_id !== user.id) return fail('只能为自己孩子发起', 403);

  const r = await query(
    `INSERT INTO aftersales_cases (case_no,student_id,order_id,order_item_id,type,reason,status,priority,description,created_by,assigned_to)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [genNo('AS'), s.id, body.order_id || null, body.order_item_id || null,
     body.type, body.reason, 'open', body.priority === 'high' ? 'high' : 'normal',
     body.description || null, user.id, body.assigned_to || null]);
  const caseId = (r as any).insertId;
  await logActivity({ student_id: s.id, order_id: body.order_id || null, actor: user,
    action: '发起售后工单', detail: `${body.type}/${body.reason} ${body.description || ''}` });
  return ok({ id: caseId });
});
