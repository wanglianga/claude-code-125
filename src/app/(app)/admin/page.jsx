import Link from 'next/link';
import { requireUser } from '../../../lib/session';
import { q, one } from '../../../lib/db';
import { L, fmtMoney, label } from '../../../lib/util';
import { Badge, Msg, Stat } from '../../../components/ui';

export default async function AdminHome({ searchParams }) {
  await requireUser(['ADMIN']);
  const stats = {
    plans: (await one('SELECT COUNT(*) AS c FROM order_plans WHERE status NOT IN (\'DRAFT\',\'CLOSED\',\'COMPLETED\')')).c,
    orders: (await one('SELECT COUNT(*) AS c FROM orders WHERE status=\'CONFIRMED\'')).c,
    unpaid: (await one('SELECT COUNT(*) AS c FROM orders WHERE status=\'CONFIRMED\' AND pay_status=\'UNPAID\'')).c,
    late: (await one('SELECT COUNT(*) AS c FROM orders WHERE is_late=1')).c,
    revenue: (await one('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE type=\'PAY\'')).s,
    refund: (await one('SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE type=\'REFUND\'')).s,
    batches: (await one('SELECT COUNT(*) AS c FROM production_batches WHERE status NOT IN (\'CLOSED\')')).c,
    tickets: (await one('SELECT COUNT(*) AS c FROM aftersales WHERE status NOT IN (\'RESOLVED\',\'CLOSED\',\'REJECTED\')')).c,
    unsigned: (await one('SELECT COUNT(*) AS c FROM distribution_records WHERE status!=\'SIGNED\'')).c,
  };
  const activePlans = await q(
    `SELECT p.*, c.name AS campus_name,
       (SELECT COUNT(*) FROM orders o WHERE o.plan_id=p.id AND o.status='CONFIRMED') AS orders,
       (SELECT COUNT(*) FROM orders o WHERE o.plan_id=p.id AND o.pay_status='PAID') AS paid
     FROM order_plans p JOIN campuses c ON c.id=p.campus_id
     WHERE p.status NOT IN ('DRAFT','CLOSED') ORDER BY p.id DESC`);
  const recentTickets = await q(
    `SELECT a.*, s.name AS student_name FROM aftersales a JOIN students s ON s.id=a.student_id
     WHERE a.status NOT IN ('RESOLVED','CLOSED','REJECTED') ORDER BY a.id DESC LIMIT 8`);

  return (
    <>
      <div className="page-title">总务工作台</div>
      <Msg searchParams={searchParams} />
      <div className="grid cols-4 mb">
        <Stat num={stats.plans} label="进行中计划" />
        <Stat num={stats.orders} label="有效订单" />
        <Stat num={stats.unpaid} label="未缴费订单" tone="warn" />
        <Stat num={stats.late} label="迟缴费记录" tone="danger" />
        <Stat num={fmtMoney(stats.revenue)} label="累计收款" />
        <Stat num={fmtMoney(stats.refund)} label="累计退款" />
        <Stat num={stats.batches} label="生产批次" />
        <Stat num={stats.tickets} label="待处理售后" tone="warn" />
      </div>
      <div className="card">
        <h3>进行中的订购计划</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>计划</th><th>校区</th><th>状态</th><th>缴费截止</th><th>订单/已缴费</th><th></th></tr></thead>
            <tbody>
              {activePlans.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.campus_name}</td>
                  <td><Badge text={label(L.planStatus, p.status)} /></td>
                  <td>{p.pay_deadline || '—'}</td>
                  <td>{p.orders} / {p.paid}</td>
                  <td><Link className="btn sm" href={`/admin/plans/${p.id}`}>管理</Link></td>
                </tr>
              ))}
              {activePlans.length === 0 && <tr><td colSpan={6} className="muted">暂无进行中的计划</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3>待处理售后工单 <Link href="/admin/aftersales" className="small">全部 →</Link></h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>工单号</th><th>学生</th><th>类型</th><th>状态</th><th>原因</th></tr></thead>
            <tbody>
              {recentTickets.map((t) => (
                <tr key={t.id}>
                  <td>{t.ticket_no}</td>
                  <td>{t.student_name}</td>
                  <td>{label(L.asType, t.type)}</td>
                  <td><Badge text={label(L.asStatus, t.status)} /></td>
                  <td className="small">{t.reason?.slice(0, 40)}</td>
                </tr>
              ))}
              {recentTickets.length === 0 && <tr><td colSpan={5} className="muted">暂无待处理工单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
