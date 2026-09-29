import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { createShipment, markShipped, markArrived } from '../../../../../lib/actions/supplier';
import { L, fmtDT, fmtMoney, label } from '../../../../../lib/util';
import { Badge, Msg } from '../../../../../components/ui';

export default async function SupplierBatchDetail({ params, searchParams }) {
  const user = await requireUser(['SUPPLIER']);
  const batch = await one(
    `SELECT b.*, p.title AS plan_title FROM production_batches b JOIN order_plans p ON p.id=b.plan_id
     WHERE b.id=? AND b.supplier_id=?`, [params.id, user.supplier_id]);
  if (!batch) redirect('/supplier?error=' + encodeURIComponent('批次不存在或不属于贵司'));
  const back = `/supplier/batches/${batch.id}`;

  const orders = await q(
    `SELECT o.*, st.name AS student_name, c.name AS class_name,
       (SELECT sh.id FROM shipments sh JOIN shipment_orders so ON so.shipment_id=sh.id
         WHERE so.order_id=o.id ORDER BY sh.id DESC LIMIT 1) AS shipment_id,
       (SELECT sh.status FROM shipments sh JOIN shipment_orders so ON so.shipment_id=sh.id
         WHERE so.order_id=o.id ORDER BY sh.id DESC LIMIT 1) AS shipment_status
     FROM orders o JOIN students st ON st.id=o.student_id JOIN classes c ON c.id=st.class_id
     WHERE o.batch_id=? AND o.status='CONFIRMED' ORDER BY o.id`, [batch.id]);
  const sizeAgg = await q(
    `SELECT oi.item_name, oi.size, SUM(oi.qty) AS qty FROM order_items oi
     JOIN orders o ON o.id=oi.order_id WHERE o.batch_id=? AND o.status='CONFIRMED'
     GROUP BY oi.item_name, oi.size ORDER BY oi.item_name, oi.size`, [batch.id]);
  const shipments = await q(
    `SELECT sh.*, (SELECT COUNT(*) FROM shipment_orders so WHERE so.shipment_id=sh.id) AS orders
     FROM shipments sh WHERE sh.batch_id=? ORDER BY sh.id`, [batch.id]);
  const unshipped = orders.filter((o) => !o.shipment_id);

  return (
    <>
      <div className="between">
        <div className="page-title">批次 {batch.batch_no} <span className="muted small">{batch.plan_title}</span></div>
        <Link href="/supplier" className="btn ghost sm">返回工作台</Link>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <div className="flex">
          <Badge text={label(L.batchStatus, batch.status)} />
          <span className="muted small">预计到校 {batch.expected_arrival || '待定'} · 订单 {orders.length} 笔</span>
          {batch.note && <span className="muted small">备注：{batch.note}</span>}
        </div>
      </div>

      <div className="card">
        <h3>生产尺码汇总</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>项目</th><th>尺码</th><th>数量</th></tr></thead>
            <tbody>
              {sizeAgg.map((r, i) => <tr key={i}><td>{r.item_name}</td><td><b>{r.size}</b></td><td>{r.qty}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>创建发货单（分批发货）<span className="sub">勾选本次发货的订单，剩余订单可下次再发</span></h3>
        {unshipped.length > 0 ? (
          <form action={createShipment}>
            <input type="hidden" name="batch_id" value={batch.id} />
            <div className="tbl-wrap mb">
              <table className="tbl">
                <thead><tr><th></th><th>订单号</th><th>学生</th><th>班级</th><th>金额</th></tr></thead>
                <tbody>
                  {unshipped.map((o) => (
                    <tr key={o.id}>
                      <td><input type="checkbox" name="order_ids" value={o.id} /></td>
                      <td>{o.order_no}</td>
                      <td>{o.student_name}</td>
                      <td>{o.class_name}</td>
                      <td>{fmtMoney(o.final_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex">
              <input name="note" placeholder="发货备注（如：第一批）" style={{ width: 220, padding: '6px 9px' }} />
              <button className="btn sm">创建发货单</button>
            </div>
          </form>
        ) : (
          <div className="muted small">本批次订单均已分配发货单。</div>
        )}
      </div>

      <div className="card">
        <h3>发货单</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>发货单号</th><th>状态</th><th>订单数</th><th>发出时间</th><th>到校时间</th><th>操作</th></tr></thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td>{s.shipment_no}</td>
                  <td><Badge text={label(L.shipmentStatus, s.status)} /></td>
                  <td>{s.orders}</td>
                  <td>{fmtDT(s.shipped_at)}</td>
                  <td>{fmtDT(s.arrived_at)}</td>
                  <td className="nowrap">
                    {s.status === 'PREPARING' && (
                      <form action={markShipped} className="inline">
                        <input type="hidden" name="shipment_id" value={s.id} />
                        <button className="btn sm">确认发货</button>
                      </form>
                    )}
                    {s.status === 'SHIPPED' && (
                      <form action={markArrived} className="inline">
                        <input type="hidden" name="shipment_id" value={s.id} />
                        <button className="btn sm">确认到校</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!shipments.length && <tr><td colSpan={6} className="muted">尚未创建发货单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>全部订单明细</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>订单号</th><th>学生</th><th>班级</th><th>缴费</th><th>发货状态</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_no}</td>
                  <td>{o.student_name}</td>
                  <td>{o.class_name}</td>
                  <td><Badge text={label(L.payStatus, o.pay_status)} /></td>
                  <td>{o.shipment_status ? <Badge text={label(L.shipmentStatus, o.shipment_status)} /> : <span className="muted">未发货</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
