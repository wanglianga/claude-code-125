import Link from 'next/link';
import { requireUser } from '../../../lib/session';
import { q } from '../../../lib/db';
import { studentProgress } from '../../../lib/queries';
import { buildSteps } from '../../../lib/steps';
import { L, fmtMoney, label } from '../../../lib/util';
import { Badge, Steps, Msg } from '../../../components/ui';

export default async function ParentHome({ searchParams }) {
  const user = await requireUser(['PARENT']);
  const children = await q(
    `SELECT s.*, c.name AS class_name, g.name AS grade_name, cp.name AS campus_name
     FROM students s JOIN classes c ON c.id=s.class_id JOIN grades g ON g.id=c.grade_id
     JOIN campuses cp ON cp.id=g.campus_id
     WHERE s.parent_id=? ORDER BY s.id`, [user.id]);

  const rows = [];
  for (const stu of children) {
    const plans = await q(
      `SELECT p.* FROM order_plans p JOIN plan_classes pc ON pc.plan_id=p.id
       WHERE pc.class_id=? AND p.status NOT IN ('DRAFT','CLOSED') ORDER BY p.id DESC`, [stu.class_id]);
    for (const plan of plans) {
      const prog = await studentProgress(plan.id, stu.id);
      rows.push({ stu, plan, prog });
    }
  }

  return (
    <>
      <div className="page-title">我的孩子</div>
      <Msg searchParams={searchParams} />
      {rows.length === 0 && (
        <div className="card muted">当前没有进行中的校服订购计划，或孩子尚未绑定班级。</div>
      )}
      {rows.map(({ stu, plan, prog }) => (
        <div className="card" key={`${stu.id}-${plan.id}`}>
          <div className="between">
            <div>
              <b style={{ fontSize: 16 }}>{stu.name}</b>{' '}
              <span className="muted small">{stu.campus_name} · {stu.class_name} · 学号 {stu.student_no}</span>{' '}
              {stu.is_poverty ? <Badge text="贫困生减免" tone="warn" /> : null}
              {stu.status === 'TRANSFERRED' ? <Badge text="已转学" tone="muted" /> : null}
            </div>
            <Link className="btn sm" href={`/parent/children/${stu.id}?plan=${plan.id}`}>进入办理</Link>
          </div>
          <div className="small muted mt">{plan.title}（{label(L.planStatus, plan.status)}，缴费截止 {plan.pay_deadline || '待定'}）</div>
          <Steps flags={buildSteps(prog)} />
          <div className="flex small mt">
            {prog.order ? (
              <>
                <span>订单 <Link href={`/orders/${prog.order.id}`}>{prog.order.order_no}</Link></span>
                <Badge text={label(L.payStatus, prog.order.pay_status)} />
                {prog.order.is_late ? <Badge text="迟缴费" tone="danger" /> : null}
                <span>应缴 {fmtMoney(prog.order.final_amount)}</span>
                {prog.order.discount_amount > 0 && <span className="muted">（已减免 {fmtMoney(prog.order.discount_amount)}）</span>}
              </>
            ) : (
              <span className="muted">尚未确认订单</span>
            )}
            {prog.tickets.length > 0 && <span>售后工单 {prog.tickets.length} 件</span>}
          </div>
        </div>
      ))}
    </>
  );
}
