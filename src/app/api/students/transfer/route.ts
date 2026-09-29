import { NextRequest } from 'next/server';
import { query, one, tx } from '@/lib/db';
import { api, ok, fail, logActivity, genNo } from '@/lib/api';

// 转学处理：学生标记 transferred；未完成订单挂起（转学），已缴费订单生成退款工单+退款记录
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const s = await one<any>('SELECT * FROM students WHERE id=?', [body.student_id]);
  if (!s) return fail('学生不存在', 404);
  if (s.status === 'transferred') return fail('该生已办理转学，请勿重复操作');

  await query('UPDATE students SET status=?, transferred_at=NOW() WHERE id=?', ['transferred', s.id]);

  const openOrders = await query<any>(
    `SELECT * FROM orders WHERE student_id=? AND status IN ('confirmed','paid','hold')`, [s.id]);
  const createdCases: number[] = [];
  for (const o of openOrders) {
    if (o.status !== 'hold') {
      await query(`UPDATE orders SET status='hold', hold_reason='学生转学，订单暂缓' WHERE id=?`, [o.id]);
    }
    if (Number(o.paid_amount) > 0) {
      const caseId = await tx(async (conn) => {
        const [cr]: any = await conn.query(
          `INSERT INTO aftersales_cases (case_no,student_id,order_id,type,reason,status,description,created_by)
           VALUES (?,?,?,?,?,?,?,?)`,
          [genNo('AS'), s.id, o.id, 'transfer_cancel', 'transfer', 'open',
           '学生转学，申请退还已缴校服费', user.id]);
        const cid = cr.insertId;
        await conn.query(
          `INSERT INTO refund_records (case_id,amount,reason,status) VALUES (?,?,?, 'requested')`,
          [cid, o.paid_amount, '转学退费']);
        return cid;
      });
      createdCases.push(caseId);
    }
    await logActivity({ student_id: s.id, order_id: o.id, actor: user, action: '学生转学', detail: `订单 ${o.order_no} 已暂缓${Number(o.paid_amount) > 0 ? '，待退款 ¥' + o.paid_amount : ''}` });
  }
  return ok({ case_ids: createdCases });
}, ['admin', 'general_affairs']);
