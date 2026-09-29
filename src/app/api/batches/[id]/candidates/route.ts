import { NextRequest } from 'next/server';
import { one, query } from '@/lib/db';
import { api, ok, fail } from '@/lib/api';

// 批次可发货候选：本批次已分配到学生、尚未发满的订单明细
export const GET = api(async (_req: NextRequest, _b: any, user, ctx) => {
  const id = ctx.params.id;
  const batch = await one<any>('SELECT * FROM production_batches WHERE id=?', [id]);
  if (!batch) return fail('批次不存在', 404);
  if (user.supplier_id && batch.supplier_id !== user.supplier_id) return fail('无权限', 403);
  const candidates = await query(
    `SELECT oi.id order_item_id, oi.name item_name, oi.size, oi.garment_type,
            s.name student_name, s.student_no, c.name class_name,
            (SELECT COALESCE(SUM(ba.qty),0) FROM batch_allocations ba
               JOIN batch_items bi ON bi.id=ba.batch_item_id
              WHERE ba.order_item_id=oi.id AND bi.batch_id=?) alloc_qty,
            (SELECT COALESCE(SUM(sl.qty),0) FROM shipment_lines sl
               JOIN shipments sh ON sh.id=sl.shipment_id
              WHERE sl.order_item_id=oi.id AND sh.batch_id=?) shipped_qty
       FROM batch_allocations ba
       JOIN batch_items bi ON bi.id=ba.batch_item_id
       JOIN order_items oi ON oi.id=ba.order_item_id
       JOIN orders o ON o.id=oi.order_id
       JOIN students s ON s.id=o.student_id
       JOIN classes c ON c.id=o.class_id
      WHERE bi.batch_id=?
      GROUP BY oi.id
     HAVING alloc_qty - shipped_qty > 0
      ORDER BY c.id, s.student_no`,
    [id, id, id]);
  return ok({ candidates: candidates.map((c: any) => ({ ...c, avail: c.alloc_qty - c.shipped_qty })) });
}, ['supplier', 'factory', 'admin', 'general_affairs']);
