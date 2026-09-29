import { NextRequest } from 'next/server';
import { query, one, tx } from '@/lib/db';
import { api, ok, fail, logActivity, genNo } from '@/lib/api';

export const GET = api(async (req: NextRequest) => {
  const planId = req.nextUrl.searchParams.get('plan_id');
  const rows = await query(
    `SELECT sh.*, pb.batch_no, p.name plan_name,
            (SELECT COALESCE(SUM(sl.qty),0) FROM shipment_lines sl WHERE sl.shipment_id=sh.id) ship_qty,
            (SELECT COALESCE(SUM(sl.arrived_qty),0) FROM shipment_lines sl WHERE sl.shipment_id=sh.id) arrived_qty,
            (SELECT COALESCE(SUM(sl.missing_qty),0) FROM shipment_lines sl WHERE sl.shipment_id=sh.id) missing_qty
     FROM shipments sh
     JOIN production_batches pb ON pb.id=sh.batch_id
     JOIN plans p ON p.id=pb.plan_id
     ${planId ? 'WHERE sh.id IN (SELECT id FROM (SELECT sh2.id FROM shipments sh2 JOIN production_batches pb2 ON pb2.id=sh2.batch_id WHERE pb2.plan_id=?) x)' : ''}
     ORDER BY sh.id DESC`, planId ? [planId] : []);
  return ok({ shipments: rows });
});

// 供应商分批发货：只能发本批次已分配给已缴费学生、且未发满的明细
export const POST = api(async (_req: NextRequest, body: any, user) => {
  const batch = await one<any>('SELECT * FROM production_batches WHERE id=?', [body.batch_id]);
  if (!batch) return fail('批次不存在', 404);
  if (user.supplier_id && batch.supplier_id !== user.supplier_id) return fail('无权限', 403);
  const lines: any[] = body.lines || [];
  if (!lines.length) return fail('请填写发货明细');

  const shipmentId = await tx(async (conn) => {
    const [sr]: any = await conn.query(
      `INSERT INTO shipments (shipment_no,batch_id,carrier,tracking_no,shipped_at,expected_arrival)
       VALUES (?,?,?,?,?,?)`,
      [genNo('SH'), batch.id, body.carrier || null, body.tracking_no || null,
       body.shipped_at || new Date().toISOString().slice(0, 19).replace('T', ' '), body.expected_arrival]);
    const sid = sr.insertId;

    for (const ln of lines) {
      const qty = Number(ln.qty);
      if (qty <= 0) continue;
      // 该明细被本批次分配的数量上限
      const alloc = await one<any>(
        `SELECT COALESCE(SUM(ba.qty),0) alloc
           FROM batch_allocations ba JOIN batch_items bi ON bi.id=ba.batch_item_id
          WHERE ba.order_item_id=? AND bi.batch_id=?`,
        [ln.order_item_id, batch.id]);
      const sent = await one<any>(
        `SELECT COALESCE(SUM(sl.qty),0) sent
           FROM shipment_lines sl JOIN shipments s2 ON s2.id=sl.shipment_id
          WHERE sl.order_item_id=? AND s2.batch_id=?`,
        [ln.order_item_id, batch.id]);
      const avail = Number(alloc.alloc) - Number(sent.sent);
      if (qty > avail) {
        throw Object.assign(new Error(`明细 #${ln.order_item_id} 本批次可发 ${avail} 件，不能发 ${qty} 件`), { status: 400 });
      }
      await conn.query('INSERT INTO shipment_lines (shipment_id,order_item_id,qty) VALUES (?,?,?)',
        [sid, ln.order_item_id, qty]);
      await conn.query('UPDATE order_items SET shipped_qty=shipped_qty+? WHERE id=?', [qty, ln.order_item_id]);
    }
    await conn.query("UPDATE production_batches SET status='part_shipped' WHERE id=? AND status IN ('produced','in_production')", [batch.id]);
    return sid;
  });
  await logActivity({ actor: user, action: '供应商发货', detail: `批次 ${batch.batch_no} 第 ${body.sequence || ''} 批` });
  return ok({ id: shipmentId });
}, ['supplier', 'factory', 'admin']);
