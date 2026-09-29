import { NextRequest } from 'next/server';
import { one, query, tx } from '@/lib/db';
import { api, ok, fail, logActivity } from '@/lib/api';

export const GET = api(async (_req: NextRequest, _b: any, user, ctx) => {
  const id = ctx.params.id;
  const sh = await one<any>(
    `SELECT sh.*, pb.batch_no FROM shipments sh JOIN production_batches pb ON pb.id=sh.batch_id WHERE sh.id=?`,
    [id]);
  if (!sh) return fail('发货单不存在', 404);
  const lines = await query(
    `SELECT sl.*, oi.size, oi.name item_name, oi.garment_type,
            s.name student_name, s.student_no, c.name class_name, o.id order_id, o.student_id
     FROM shipment_lines sl
     JOIN order_items oi ON oi.id=sl.order_item_id
     JOIN orders o ON o.id=oi.order_id
     JOIN students s ON s.id=o.student_id
     JOIN classes c ON c.id=o.class_id
     WHERE sl.shipment_id=? ORDER BY c.id, s.student_no`, [id]);
  return ok({ shipment: sh, lines });
});

// 学校总务确认到校：逐行登记实际到校数（小于发货数即为工厂漏发，待售后补发）
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const sh = await one<any>('SELECT * FROM shipments WHERE id=?', [body.id]);
  if (!sh) return fail('发货单不存在', 404);

  await tx(async (conn) => {
    for (const ln of body.lines || []) {
      const row = await one<any>('SELECT * FROM shipment_lines WHERE id=? AND shipment_id=?', [ln.id, sh.id]);
      if (!row) continue;
      const arrived = Math.min(Number(ln.arrived_qty), row.qty);
      await conn.query('UPDATE shipment_lines SET arrived_qty=?, missing_qty=? WHERE id=?',
        [arrived, row.qty - arrived, row.id]);
      if (row.qty - arrived > 0) {
        const oi = await one<any>('SELECT o.student_id, o.id order_id, oi.name, oi.size FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.id=?', [row.order_item_id]);
        await conn.query(
          `INSERT INTO activity_log (student_id,order_id,actor_role,actor_name,action,detail)
           VALUES (?,?,?,?,?,?)`,
          [oi?.student_id || null, oi?.order_id || null,
           user.role, user.real_name, '确认到货-工厂漏发',
           `发货单 ${sh.shipment_no} ${oi?.name || ''}(${oi?.size || ''}) 少 ${row.qty - arrived} 件，需补发`]);
      }
    }
    await conn.query("UPDATE shipments SET status='arrived' WHERE id=?", [sh.id]);
  });
  await logActivity({ actor: user, action: '确认校服到校', detail: sh.shipment_no });
  return ok();
}, ['general_affairs', 'admin']);
