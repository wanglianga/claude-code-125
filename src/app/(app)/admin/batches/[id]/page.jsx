import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { L, fmtDT, fmtMoney, label } from '../../../../../lib/util';
import { Badge, Msg } from '../../../../../components/ui';

export default async function BatchDetail({ params, searchParams }) {
  await requireUser(['ADMIN']);
  const batch = await one(
    `SELECT b.*, s.name AS supplier_name, p.title AS plan_title FROM production_batches b
     JOIN suppliers s ON s.id=b.supplier_id JOIN order_plans p ON p.id=b.plan_id WHERE b.id=?`, [params.id]);
  if (!batch) redirect('/admin/batches');
  const orders = await q(
    `SELECT o.*, st.name AS student_name, c.name AS class_name,
       (SELECT sh.status FROM shipments sh JOIN shipment_orders so ON so.shipment_id=sh.id
         WHERE so.order_id=o.id ORDER BY sh.id DESC LIMIT 1) AS shipment_status
     FROM orders o JOIN students st ON st.id=o.student_id JOIN classes c ON c.id=st.class_id
     WHERE o.batch_id=? ORDER BY o.id`, [batch.id]);
  const sizeAgg = await q(
    `SELECT oi.item_name, oi.size, SUM(oi.qty) AS qty FROM order_items oi
     JOIN orders o ON o.id=oi.order_id WHERE o.batch_id=? AND o.status='CONFIRMED'
     GROUP BY oi.item_name, oi.size ORDER BY oi.item_name, oi.size`, [batch.id]);
  const shipments = await q(
    `SELECT sh.*, (SELECT COUNT(*) FROM shipment_orders so WHERE so.shipment_id=sh.id) AS orders
     FROM shipments sh WHERE sh.batch_id=? ORDER BY sh.id`, [batch.id]);
  const events = await q('SELECT * FROM events WHERE entity=? AND entity_id=? ORDER BY id DESC LIMIT 20', ['BATCH', batch.id]);

  return (
    <>
      <div className="between">
        <div className="page-title">批次 {batch.batch_no}</div>
        <Link href="/admin/batches" className="btn ghost sm">返回批次列表</Link>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <div className="flex">
          <Badge text={label(L.batchStatus, batch.status)} />
          <span className="muted small">{batch.plan_title} · 供应商：{batch.supplier_name} · 预计到校 {batch.expected_arrival || '待定'}</span>
          {batch.note && <span className="muted small">备注：{batch.note}</span>}
        </div>
      </div>
      <div className="card">
        <h3>尺码汇总（工厂生产依据）</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>项目</th><th>尺码</th><th>数量</th></tr></thead>
            <tbody>
              {sizeAgg.map((r, i) => (
                <tr key={i}><td>{r.item_name}</td><td><b>{r.size}</b></td><td>{r.qty}</td></tr>
              ))}
              {!sizeAgg.length && <tr><td colSpan={3} className="muted">暂无</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>批次订单（{orders.length}）</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>订单号</th><th>学生</th><th>班级</th><th>金额</th><th>缴费</th><th>发货状态</th><th></th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.order_no}</td>
                  <td>{o.student_name}</td>
                  <td>{o.class_name}</td>
                  <td>{fmtMoney(o.final_amount)}</td>
                  <td><Badge text={label(L.payStatus, o.pay_status)} /></td>
                  <td>{o.shipment_status ? <Badge text={label(L.shipmentStatus, o.shipment_status)} /> : <span className="muted">未发货</span>}</td>
                  <td><Link className="small" href={`/orders/${o.id}`}>详情</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>发货单（供应商分批发货）</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>发货单号</th><th>状态</th><th>订单数</th><th>发出时间</th><th>到校时间</th></tr></thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td>{s.shipment_no}</td>
                  <td><Badge text={label(L.shipmentStatus, s.status)} /></td>
                  <td>{s.orders}</td>
                  <td>{fmtDT(s.shipped_at)}</td>
                  <td>{fmtDT(s.arrived_at)}</td>
                </tr>
              ))}
              {!shipments.length && <tr><td colSpan={5} className="muted">供应商尚未创建发货单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>批次动态</h3>
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <div className="t">{fmtDT(e.created_at)} · {e.actor_name}</div>
              <div className="d">{e.detail}</div>
            </li>
          ))}
          {!events.length && <li className="muted">暂无动态</li>}
        </ul>
      </div>
    </>
  );
}
