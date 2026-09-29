import Link from 'next/link';
import { requireUser } from '../../../lib/session';
import { one, q } from '../../../lib/db';
import { planStudentProgress } from '../../../lib/queries';
import { L, fmtMoney, label } from '../../../lib/util';
import { Badge, Msg, Stat } from '../../../components/ui';

export default async function TeacherHome({ searchParams }) {
  const user = await requireUser(['TEACHER']);
  const cls = await one(
    `SELECT c.*, g.name AS grade_name, cp.name AS campus_name FROM classes c
     JOIN grades g ON g.id=c.grade_id JOIN campuses cp ON cp.id=g.campus_id
     WHERE c.teacher_id=?`, [user.id]);
  if (!cls) return <div className="card">您尚未绑定班级，请联系总务处。</div>;

  const plans = await q(
    `SELECT p.* FROM order_plans p JOIN plan_classes pc ON pc.plan_id=p.id
     WHERE pc.class_id=? AND p.status NOT IN ('DRAFT','CLOSED') ORDER BY p.id DESC`, [cls.id]);
  const planId = Number(searchParams.plan) || plans[0]?.id;
  const plan = plans.find((p) => p.id === planId);
  const rows = plan ? await planStudentProgress(plan.id, cls.id) : [];

  const cnt = (fn) => rows.filter(fn).length;
  const stats = plan ? [
    ['学生数', rows.filter((r) => r.student_status === 'ACTIVE').length],
    ['已填信息', cnt((r) => r.measured)],
    ['已试穿', cnt((r) => r.fitted)],
    ['已确认订单', cnt((r) => r.order_id)],
    ['已缴费', cnt((r) => r.pay_status === 'PAID')],
    ['已签收', cnt((r) => r.dist_status === 'SIGNED')],
    ['售后中', cnt((r) => r.open_tickets > 0)],
  ] : [];

  return (
    <>
      <div className="page-title">班级总览 <span className="muted small">{cls.campus_name} · {cls.name}</span></div>
      <Msg searchParams={searchParams} />
      {plans.length > 1 && (
        <div className="flex mb">
          {plans.map((p) => (
            <Link key={p.id} href={`/teacher?plan=${p.id}`} className={`btn sm ${p.id === planId ? '' : 'ghost'}`}>
              {p.title}
            </Link>
          ))}
        </div>
      )}
      {!plan && <div className="card muted">当前班级暂无进行中的订购计划。</div>}
      {plan && (
        <>
          <div className="grid cols-4 mb" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {stats.map(([lbl, n]) => <Stat key={lbl} num={n} label={lbl} />)}
          </div>
          <div className="card">
            <h3>{plan.title} <span className="sub">{label(L.planStatus, plan.status)} · 缴费截止 {plan.pay_deadline || '待定'}</span></h3>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>学号</th><th>姓名</th><th>信息</th><th>试穿</th><th>订单</th><th>缴费</th><th>生产/到校</th><th>签收</th><th>售后</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student_id} style={r.student_status === 'TRANSFERRED' ? { opacity: 0.5 } : undefined}>
                      <td className="nowrap">{r.student_no}</td>
                      <td>
                        {r.student_name}
                        {r.is_poverty ? <Badge text="贫困生" tone="warn" /> : null}
                        {r.student_status === 'TRANSFERRED' ? <Badge text="转学" tone="muted" /> : null}
                      </td>
                      <td>{r.measured ? '✓' : <span className="muted">—</span>}</td>
                      <td>{r.fitted ? '✓' : <span className="muted">—</span>}</td>
                      <td>
                        {r.order_id ? <Link href={`/orders/${r.order_id}`}>{r.order_no}</Link> : <span className="muted">未确认</span>}
                      </td>
                      <td>
                        {r.order_id ? <Badge text={label(L.payStatus, r.pay_status)} /> : '—'}
                        {r.is_late ? <Badge text="迟缴" tone="danger" /> : null}
                      </td>
                      <td className="small">
                        {r.batch_status ? label(L.batchStatus, r.batch_status) : '—'}
                        {r.shipment_status ? ` / ${label(L.shipmentStatus, r.shipment_status)}` : ''}
                      </td>
                      <td>{r.dist_status ? <Badge text={label(L.drStatus, r.dist_status)} /> : '—'}</td>
                      <td>{r.open_tickets > 0 ? <Badge text={`${r.open_tickets}件`} tone="warn" /> : '—'}</td>
                      <td>{r.order_id && <Link className="small" href={`/orders/${r.order_id}`}>详情</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
