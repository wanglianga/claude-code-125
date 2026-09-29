import { NextRequest } from 'next/server';
import { one, query, tx } from '@/lib/db';
import { api, ok, fail, logActivity } from '@/lib/api';

// 时段详情：班级学生 + 已登记的试穿记录
export const GET = api(async (_req: NextRequest, _b: any, user, ctx) => {
  const id = ctx.params.id;
  const session = await one<any>(
    `SELECT fs.*, c.name class_name FROM fitting_sessions fs JOIN classes c ON c.id=fs.class_id WHERE fs.id=?`,
    [id]);
  if (!session) return fail('时段不存在', 404);
  const students = await query(
    `SELECT s.*, fr.id record_id, fr.size_top, fr.size_pants, fr.size_skirt, fr.size_coat,
            fr.size_shoes, fr.special_note, fr.staff_name
     FROM students s
     LEFT JOIN fitting_records fr ON fr.student_id=s.id AND fr.session_id=?
     WHERE s.class_id=? AND s.status='active'
     ORDER BY s.student_no`, [id, session.class_id]);
  return ok({ session, students });
});

// 工作人员记录/更新某学生五类尺码建议
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const session = await one<any>('SELECT * FROM fitting_sessions WHERE id=?', [body.session_id]);
  if (!session) return fail('试穿时段不存在', 404);
  await tx(async (conn) => {
    const exist = await one('SELECT id FROM fitting_records WHERE session_id=? AND student_id=?',
      [body.session_id, body.student_id]);
    if (exist) {
      await conn.query(
        `UPDATE fitting_records SET staff_name=?,size_top=?,size_pants=?,size_skirt=?,size_coat=?,size_shoes=?,special_note=?
         WHERE id=?`,
        [body.staff_name || user.real_name, body.size_top || null, body.size_pants || null,
         body.size_skirt || null, body.size_coat || null, body.size_shoes || null,
         body.special_note || null, exist.id]);
    } else {
      await conn.query(
        `INSERT INTO fitting_records (session_id,student_id,staff_name,size_top,size_pants,size_skirt,size_coat,size_shoes,special_note)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [body.session_id, body.student_id, body.staff_name || user.real_name,
         body.size_top || null, body.size_pants || null, body.size_skirt || null,
         body.size_coat || null, body.size_shoes || null, body.special_note || null]);
    }
  });
  await logActivity({ student_id: body.student_id, actor: user, action: '登记试穿尺码建议',
    detail: `上衣${body.size_top || '-'} 裤${body.size_pants || '-'} 裙${body.size_skirt || '-'} 外套${body.size_coat || '-'} 鞋${body.size_shoes || '-'}` });
  return ok();
}, ['head_teacher', 'general_affairs', 'admin']);
