import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../lib/session';
import { one, q } from '../../../../lib/db';
import { orderTimeline } from '../../../../lib/queries';
import { L, fmtDT, fmtMoney, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function Order360({ params, searchParams }) {
  const user = await requireUser(['ADMIN', 'TEACHER', 'PARENT', 'SERVICE']);
  const order = await one(
    `SELECT o.*, s.name AS student_name, s.student_no, s.is_poverty, s.status AS student_status,
       c.name AS class_name, c.teacher_id, p.title AS plan_title, u.name AS parent_name
     FROM orders o
     JOIN students s ON s.id=o.student_id
     JOIN classes c ON c.id=s.class_id
     JOIN order_plans p ON p.id=o.plan_id
     LEFT JOIN users u ON u.id=o.parent_id
     WHERE o.id=?`, [params.id]);
  if (!order) redirect('/');
  // 权限：家长只能看自己孩子的订单；班主任只能看自己班
  if (user.role === 'PARENT' && order.parent_id !== user.id) redirect('/parent?error=' + encodeURIComponent('无权查看该订单'));
  if (user.role === 'TEACHER' && order.teacher_id !== user.id) redirect('/teacher?error=' + encodeURIComponent('无权查看该订单'));

  const items = await q('SELECT * FROM order_items WHERE order_id=?', [order.id]);
  const { events, payments, tickets } = await orderTimeline(order.id);
  const batch = order.batch_id
    ? await one('SELECT b.*, s.name AS supplier_name FROM production_batches b JOIN suppliers s ON s.id=b.supplier_id WHERE b.id=?', [order.batch_id])
    : null;
  const shipment = await one(
    `SELECT sh.* FROM shipments sh JOIN shipment_orders so ON so.shipment_id=sh.id
     WHERE so.order_id=? ORDER BY sh.id DESC LIMIT 1`, [order.id]);
  const dist = await one(
    `SELECT dr.*, d.title, d.slot_start, d.location FROM distribution_records dr
     JOIN distributions d ON d.id=dr.distribution_id WHERE dr.order_id=? ORDER BY dr.id DESC LIMIT 1`, [order.id]);

  return (
    <>
      <div className="between">
        <div className="page-title">订单 {order.order_no}</div>
        <Link href={{ ADMIN: '/admin', TEACHER: '/teacher', PARENT: '/parent', SERVICE: '/service' }[user.role] || '/'} className="btn ghost sm">返回工作台</Link>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <div className="grid cols-3 small">
          <div><span className="muted">学生：</span>{order.student_name}（{order.student_no} · {order.class_name}）
            {order.is_poverty ? <Badge text="贫困生" tone="warn" /> : null}
            {order.student_status === 'TRANSFERRED' ? <Badge text="已转学" tone="muted" /> : null}
          </div>
          <div><span className="muted">家长：</span>{order.parent_name || '—'}</div>
          <div><span className="muted">计划：</span>{order.plan_title}</div>
          <div><span className="muted">订单状态：</span><Badge text={label(L.orderStatus, order.status)} /> <Badge text={label(L.payStatus, order.pay_status)} />{order.is_late ? <Badge text="迟缴费" tone="danger" /> : null}</div>
          <div><span className="muted">金额：</span>合计 {fmtMoney(order.total_amount)}{order.discount_amount > 0 ? `，减免 ${fmtMoney(order.discount_amount)}` : ''}，实缴 {fmtMoney(order.final_amount)}</div>
          <div><span className="muted">创建时间：</span>{fmtDT(order.created_at)}</div>
          {order.note && <div style={{ gridColumn: '1 / -1' }}><span className="muted">备注：</span>{order.note}</div>}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <h3>订单明细</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>项目</th><th>类别</th><th>尺码</th><th>数量</th><th>单价</th></tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.item_name}</td>
                    <td>{label(L.category, it.category)}</td>
                    <td><b>{it.size}</b></td>
                    <td>{it.qty}</td>
                    <td>{fmtMoney(it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h3>生产 / 发货 / 发放</h3>
          <div className="small" style={{ lineHeight: 2.2 }}>
            <div><span className="muted">生产批次：</span>{batch ? <>{batch.batch_no} <Badge text={label(L.batchStatus, batch.status)} />（{batch.supplier_name}，预计到校 {batch.expected_arrival || '待定'}）</> : '尚未入批次'}</div>
            <div><span className="muted">发货单：</span>{shipment ? <>{shipment.shipment_no} <Badge text={label(L.shipmentStatus, shipment.status)} />{shipment.arrived_at ? `（${fmtDT(shipment.arrived_at)} 到校）` : ''}</> : '未发货'}</div>
            <div><span className="muted">发放签收：</span>{dist ? <>{dist.title} <Badge text={label(L.drStatus, dist.status)} />{dist.signed_by ? `（${dist.signed_by} ${fmtDT(dist.signed_at)}）` : ''}</> : '未安排'}</div>
          </div>
          <h3 className="mt">缴费流水</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>时间</th><th>类型</th><th>金额</th><th>备注</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="small nowrap">{fmtDT(p.created_at)}</td>
                    <td>{p.type === 'PAY' ? '缴费' : '退款'}</td>
                    <td>{fmtMoney(p.amount)}</td>
                    <td className="small">{p.remark || '—'}</td>
                  </tr>
                ))}
                {!payments.length && <tr><td colSpan={4} className="muted">暂无流水</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>售后工单（{tickets.length}）</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>工单号</th><th>类型</th><th>内容</th><th>状态</th><th>处理结果</th><th></th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{t.ticket_no}</td>
                  <td>{label(L.asType, t.type)}</td>
                  <td className="small">{t.item_desc || '—'}{t.from_size ? ` ${t.from_size}→${t.to_size || '?'}` : ''}</td>
                  <td><Badge text={label(L.asStatus, t.status)} /></td>
                  <td className="small">{t.resolution || '—'}</td>
                  <td>{['ADMIN', 'SERVICE'].includes(user.role) && <Link className="small" href={`/service/tickets/${t.id}`}>处理</Link>}</td>
                </tr>
              ))}
              {!tickets.length && <tr><td colSpan={6} className="muted">暂无售后工单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>订单时间线（全角色协作留痕）</h3>
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
