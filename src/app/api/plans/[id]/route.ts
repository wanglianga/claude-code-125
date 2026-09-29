import { NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { api, ok } from '@/lib/api';

// 计划详情：品类、覆盖校区年级、试穿时段、订单统计、（可选）某学生试穿建议
export const GET = api(async (req: NextRequest, _b: any, _user: any, ctx) => {
  const id = ctx.params.id;
  const studentId = req.nextUrl.searchParams.get('student_id');
  const plan = await one<any>(
    `SELECT p.*, s.name supplier_name FROM plans p JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?`, [id]);
  if (!plan) return Response.json({ ok: false, error: '计划不存在' }, { status: 404 });
  const [items, campuses, grades, sessions, stats] = await Promise.all([
    query('SELECT * FROM plan_items WHERE plan_id=? ORDER BY id', [id]),
    query(`SELECT c.* FROM plan_campuses pc JOIN campuses c ON c.id=pc.campus_id WHERE pc.plan_id=?`, [id]),
    query(`SELECT g.* FROM plan_grades pg JOIN grades g ON g.id=pg.grade_id WHERE pg.plan_id=?`, [id]),
    query(`SELECT fs.*, c.name class_name, u.real_name organizer_name,
                  (SELECT COUNT(*) FROM fitting_records fr WHERE fr.session_id=fs.id) recorded
           FROM fitting_sessions fs JOIN classes c ON c.id=fs.class_id
           LEFT JOIN users u ON u.id=fs.organizer_user_id
           WHERE fs.plan_id=? ORDER BY fs.start_time`, [id]),
    query(`SELECT status, COUNT(*) cnt FROM orders WHERE plan_id=? GROUP BY status`, [id]),
  ]);
  const fittingSuggestions = studentId ? await getFittingMap(Number(id), Number(studentId)) : null;
  return ok({ plan, items, campuses, grades, sessions, order_stats: stats, fittingSuggestions });
});

// 某学生在该计划最近一次试穿记录，按 garment_type 给出建议尺码
async function getFittingMap(planId: number, studentId: number) {
  const fr = await one<any>(
    `SELECT fr.* FROM fitting_records fr JOIN fitting_sessions fs ON fs.id=fr.session_id
     WHERE fr.student_id=? AND fs.plan_id=? ORDER BY fr.id DESC LIMIT 1`, [studentId, planId]);
  if (!fr) return null;
  return {
    top: fr.size_top, pants: fr.size_pants, skirt: fr.size_skirt,
    coat: fr.size_coat, shoes: fr.size_shoes, note: fr.special_note,
  };
}
