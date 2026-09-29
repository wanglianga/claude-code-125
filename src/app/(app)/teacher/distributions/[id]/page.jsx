import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { markDistributionRecord, completeDistribution } from '../../../../../lib/actions/teacher';
import { L, fmtDT, label } from '../../../../../lib/util';
import { Badge, Msg } from '../../../../../components/ui';

export default async function DistributionDetail({ params, searchParams }) {
  const user = await requireUser(['TEACHER']);
  const dist = await one(
    `SELECT d.*, c.name AS class_name, p.title AS plan_title FROM distributions d
     JOIN classes c ON c.id=d.class_id JOIN order_plans p ON p.id=d.plan_id WHERE d.id=?`, [params.id]);
  if (!dist) redirect('/teacher/distributions');
  const records = await q(
    `SELECT dr.*, s.name AS student_name, s.student_no, o.order_no
     FROM distribution_records dr JOIN students s ON s.id=dr.student_id JOIN orders o ON o.id=dr.order_id
     WHERE dr.distribution_id=? ORDER BY s.student_no`, [dist.id]);
  const back = `/teacher/distributions/${dist.id}`;

  return (
    <>
      <div className="between">
        <div className="page-title">{dist.title} <span className="muted small">{dist.class_name} · {fmtDT(dist.slot_start)} @ {dist.location || '待定'}</span></div>
        <Link href="/teacher/distributions" className="btn ghost sm">返回</Link>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <div className="between mb">
          <div className="flex">
            <Badge text={label(L.distType, dist.type)} />
            <Badge text={label(L.distStatus, dist.status)} />
            <span className="muted small">{dist.plan_title}</span>
          </div>
          {dist.status === 'SCHEDULED' && (
            <form action={completeDistribution}>
              <input type="hidden" name="distribution_id" value={dist.id} />
              <input type="hidden" name="plan_id" value={dist.plan_id} />
              <input type="hidden" name="redirect_to" value={back} />
              <button className="btn sm gray">结束本场发放（未领记为待补领）</button>
            </form>
          )}
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>学生</th><th>订单号</th><th>状态</th><th>签收人/时间</th><th>操作</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.student_name}</b> <span className="muted small">{r.student_no}</span></td>
                  <td><Link href={`/orders/${r.order_id}`}>{r.order_no}</Link></td>
                  <td><Badge text={label(L.drStatus, r.status)} /></td>
                  <td className="small">{r.signed_by ? `${r.signed_by} · ${fmtDT(r.signed_at)}` : '—'}</td>
                  <td className="nowrap">
                    {r.status !== 'SIGNED' && (
                      <form action={markDistributionRecord} className="inline">
                        <input type="hidden" name="record_id" value={r.id} />
                        <input type="hidden" name="status" value="SIGNED" />
                        <input type="hidden" name="redirect_to" value={back} />
                        <input name="signed_by" placeholder="签收人" style={{ width: 80, padding: '3px 6px', marginRight: 4 }} />
                        <button className="btn sm">签收</button>
                      </form>
                    )}
                    {r.status === 'PENDING' && (
                      <form action={markDistributionRecord} className="inline">
                        <input type="hidden" name="record_id" value={r.id} />
                        <input type="hidden" name="status" value="MISSED" />
                        <input type="hidden" name="redirect_to" value={back} />
                        <button className="btn sm gray">未到</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={5} className="muted">本场次没有发放记录</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
