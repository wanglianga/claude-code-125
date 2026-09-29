import { NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { api, ok, fail, logActivity } from '@/lib/api';

export const GET = api(async (_req: NextRequest, _b: any, user, ctx) => {
  const id = ctx.params.id;
  const batch = await one<any>(
    `SELECT pb.*, p.name plan_name FROM production_batches pb JOIN plans p ON p.id=pb.plan_id WHERE pb.id=?`,
    [id]);
  if (!batch) return fail('批次不存在', 404);
  const [lines, shipments] = await Promise.all([
    query(
      `SELECT bi.*, pi.name item_name, pi.garment_type,
              (SELECT COUNT(*) FROM batch_allocations ba WHERE ba.batch_item_id=bi.id) alloc_students,
              (SELECT GROUP_CONCAT(CONCAT(st.name,':',ba.qty) SEPARATOR ';')
                 FROM batch_allocations ba
                 JOIN order_items oi ON oi.id=ba.order_item_id
                 JOIN orders o ON o.id=oi.order_id
                 JOIN students st ON st.id=o.student_id
                WHERE ba.batch_item_id=bi.id) alloc_detail
       FROM batch_items bi JOIN plan_items pi ON pi.id=bi.plan_item_id
       WHERE bi.batch_id=? ORDER BY bi.id`, [id]),
    query(`SELECT sh.*, (SELECT COALESCE(SUM(sl.qty),0) FROM shipment_lines sl WHERE sl.shipment_id=sh.id) line_qty,
                  (SELECT COALESCE(SUM(sl.arrived_qty),0) FROM shipment_lines sl WHERE sl.shipment_id=sh.id) arrived_qty
             FROM shipments sh WHERE sh.batch_id=? ORDER BY sh.id`, [id]),
  ]);
  return ok({ batch, lines, shipments });
});

// 批次动作：start / produce（报产量）/ complete
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const b = await one<any>('SELECT * FROM production_batches WHERE id=?', [body.id]);
  if (!b) return fail('批次不存在', 404);
  if (user.supplier_id && b.supplier_id !== user.supplier_id) return fail('无权限', 403);

  if (body.action === 'start') {
    await query("UPDATE production_batches SET status='in_production' WHERE id=?", [b.id]);
    await logActivity({ actor: user, action: '批次开工', detail: b.batch_no });
    return ok();
  }

  if (body.action === 'produce') {
    // body.lines: [{batch_item_id, produced_qty}]
    for (const ln of body.lines || []) {
      const bi = await one<any>('SELECT * FROM batch_items WHERE id=? AND batch_id=?', [ln.batch_item_id, b.id]);
      if (!bi) continue;
      const q = Math.min(Number(ln.produced_qty), bi.qty);
      await query('UPDATE batch_items SET produced_qty=? WHERE id=?', [q, bi.id]);
    }
    await query("UPDATE production_batches SET status='produced' WHERE id=? AND status='in_production'", [b.id]);
    await logActivity({ actor: user, action: '批次报产', detail: b.batch_no });
    return ok();
  }

  if (body.action === 'complete') {
    const miss = await one<any>(
      `SELECT COUNT(*) c FROM batch_items WHERE batch_id=? AND produced_qty<qty`, [b.id]);
    if (Number(miss.c) > 0) return fail('仍有明细未完成生产');
    await query("UPDATE production_batches SET status='completed' WHERE id=?", [b.id]);
    await logActivity({ actor: user, action: '批次完成', detail: b.batch_no });
    return ok();
  }

  if (body.action === 'arrival_date') {
    await query('UPDATE production_batches SET expected_arrival=? WHERE id=?', [body.expected_arrival, b.id]);
    await logActivity({ actor: user, action: '更新预计到校时间', detail: `${b.batch_no} → ${body.expected_arrival}` });
    return ok();
  }

  return fail('未知操作');
}, ['supplier', 'factory', 'admin']);
