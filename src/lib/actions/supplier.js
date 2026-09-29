'use server';

import { revalidatePath } from 'next/cache';
import { one, q, tx } from '../db';
import { getSession } from '../session';
import { logEvent, notify, notifyRole, nextNo } from '../queries';
import { ok, fail, str, num } from './_shared';

async function requireSupplier() {
  const s = await getSession();
  if (!s || s.role !== 'SUPPLIER') fail('/login', '请以供应商身份登录');
  const u = await one('SELECT * FROM users WHERE id=?', [s.uid]);
  if (!u?.supplier_id) fail('/', '账号未绑定供应商');
  return u;
}

// 创建发货单（支持分批发货：从批次中勾选部分订单）
export async function createShipment(formData) {
  const u = await requireSupplier();
  const batchId = num(formData.get('batch_id'));
  const back = `/supplier/batches/${batchId}`;
  const batch = await one('SELECT * FROM production_batches WHERE id=? AND supplier_id=?', [batchId, u.supplier_id]);
  if (!batch) fail('/supplier', '批次不存在或不属于贵司');
  const orderIds = formData.getAll('order_ids').map(Number).filter(Boolean);
  if (!orderIds.length) fail(back, '请勾选本次发货的订单');
  // 校验订单属于该批次且未在其他发货单中
  const dup = await q(
    `SELECT so.order_id FROM shipment_orders so JOIN shipments sh ON sh.id=so.shipment_id
     WHERE sh.batch_id=? AND so.order_id IN (${orderIds.map(() => '?').join(',')})`,
    [batchId, ...orderIds]);
  if (dup.length) fail(back, `订单 #${dup.map((d) => d.order_id).join(',#')} 已在其他发货单中`);

  let shipmentNo;
  await tx(async (conn) => {
    shipmentNo = await nextNo(conn, 'shipments', 'SH2026-');
    const [r] = await conn.query(
      'INSERT INTO shipments (shipment_no, batch_id, supplier_id, note) VALUES (?,?,?,?)',
      [shipmentNo, batchId, u.supplier_id, str(formData.get('note'))]);
    for (const oid of orderIds) {
      await conn.query('INSERT INTO shipment_orders (shipment_id, order_id) VALUES (?,?)', [r.insertId, oid]);
    }
    if (batch.status === 'PRODUCED' || batch.status === 'PENDING' || batch.status === 'IN_PRODUCTION') {
      await conn.query('UPDATE production_batches SET status=\'SHIPPING\' WHERE id=? AND status IN (\'PRODUCED\',\'PENDING\',\'IN_PRODUCTION\')', [batchId]);
    }
    await logEvent('BATCH', batchId, 'SHIPMENT_CREATED', { id: u.id, name: u.name },
      `发货单 ${shipmentNo} 创建，含订单 ${orderIds.length} 笔（分批发货）`, conn);
    await notifyRole('ADMIN', '供应商发货', `批次 ${batch.batch_no} 新发货单 ${shipmentNo}（${orderIds.length} 笔订单）备货中。`, conn);
  });
  revalidatePath('/');
  ok(back, `发货单 ${shipmentNo} 已创建`);
}

export async function markShipped(formData) {
  const u = await requireSupplier();
  const shipmentId = num(formData.get('shipment_id'));
  const sh = await one('SELECT * FROM shipments WHERE id=? AND supplier_id=?', [shipmentId, u.supplier_id]);
  if (!sh) fail('/supplier', '发货单不存在');
  const back = `/supplier/batches/${sh.batch_id}`;
  await tx(async (conn) => {
    await conn.query('UPDATE shipments SET status=\'SHIPPED\', shipped_at=NOW() WHERE id=?', [shipmentId]);
    await logEvent('BATCH', sh.batch_id, 'SHIPMENT_SHIPPED', { id: u.id, name: u.name },
      `发货单 ${sh.shipment_no} 已发出`, conn);
  });
  revalidatePath('/');
  ok(back, '已标记发货');
}

export async function markArrived(formData) {
  const u = await requireSupplier();
  const shipmentId = num(formData.get('shipment_id'));
  const sh = await one('SELECT * FROM shipments WHERE id=? AND supplier_id=?', [shipmentId, u.supplier_id]);
  if (!sh) fail('/supplier', '发货单不存在');
  const back = `/supplier/batches/${sh.batch_id}`;
  await tx(async (conn) => {
    await conn.query('UPDATE shipments SET status=\'ARRIVED\', arrived_at=NOW() WHERE id=?', [shipmentId]);
    const orders = await q('SELECT order_id FROM shipment_orders WHERE shipment_id=?', [shipmentId]);
    for (const o of orders) {
      await logEvent('ORDER', o.order_id, 'SHIPMENT_ARRIVED', { id: u.id, name: u.name },
        `发货单 ${sh.shipment_no} 已到校`, conn);
    }
    // 批次全部订单到校 → 批次 ARRIVED（须用事务连接读取，才能看到本次更新）
    const [remaining] = await conn.query(
      `SELECT COUNT(*) AS c FROM orders o WHERE o.batch_id=? AND o.status='CONFIRMED'
         AND NOT EXISTS (SELECT 1 FROM shipment_orders so JOIN shipments s2 ON s2.id=so.shipment_id
                         WHERE so.order_id=o.id AND s2.status='ARRIVED')`,
      [sh.batch_id]);
    if (remaining[0].c === 0) {
      await conn.query('UPDATE production_batches SET status=\'ARRIVED\' WHERE id=?', [sh.batch_id]);
    }
    await logEvent('BATCH', sh.batch_id, 'SHIPMENT_ARRIVED', { id: u.id, name: u.name },
      `发货单 ${sh.shipment_no} 已到校（${orders.length} 笔订单）`, conn);
    await notifyRole('ADMIN', '校服到校', `发货单 ${sh.shipment_no} 已到校，共 ${orders.length} 笔订单，可安排分批发放。`, conn);
    // 通知相关班级班主任
    const teachers = await q(
      `SELECT DISTINCT u.id FROM shipment_orders so
       JOIN orders o ON o.id=so.order_id JOIN students st ON st.id=o.student_id
       JOIN classes c ON c.id=st.class_id JOIN users u ON u.id=c.teacher_id
       WHERE so.shipment_id=? AND u.id IS NOT NULL`, [shipmentId]);
    for (const t of teachers) {
      await notify(t.id, '校服到校', `您班有学生的校服已随 ${sh.shipment_no} 到校，请到发放管理中安排分批发放。`, conn);
    }
  });
  revalidatePath('/');
  ok(back, '已确认到校，学校可安排发放');
}
