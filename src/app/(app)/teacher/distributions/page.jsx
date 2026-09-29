import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { one, q } from '../../../../lib/db';
import { createDistribution } from '../../../../lib/actions/teacher';
import { L, fmtDT, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function DistributionsPage({ searchParams }) {
  const user = await requireUser(['TEACHER']);
  const cls = await one('SELECT * FROM classes WHERE teacher_id=?', [user.id]);
  if (!cls) return <div className="card">您尚未绑定班级。</div>;
  const plans = await q(
    `SELECT p.* FROM order_plans p JOIN plan_classes pc ON pc.plan_id=p.id
     WHERE pc.class_id=? AND p.status NOT IN ('DRAFT','CLOSED') ORDER BY p.id DESC`, [cls.id]);
  const list = await q(
    `SELECT d.*, p.title AS plan_title,
       (SELECT COUNT(*) FROM distribution_records dr WHERE dr.distribution_id=d.id) AS total,
       (SELECT COUNT(*) FROM distribution_records dr WHERE dr.distribution_id=d.id AND dr.status='SIGNED') AS signed,
       (SELECT COUNT(*) FROM distribution_records dr WHERE dr.distribution_id=d.id AND dr.status='MISSED') AS missed
     FROM distributions d JOIN order_plans p ON p.id=d.plan_id
     WHERE d.class_id=? ORDER BY d.slot_start DESC`, [cls.id]);
  // 可发放与待补领提示
  const arrivedUnsigned = plans.length ? await q(
    `SELECT COUNT(*) AS c FROM orders o JOIN students st ON st.id=o.student_id
     WHERE o.plan_id=? AND st.class_id=? AND o.status='CONFIRMED'
       AND EXISTS (SELECT 1 FROM shipment_orders so JOIN shipments sh ON sh.id=so.shipment_id WHERE so.order_id=o.id AND sh.status='ARRIVED')
       AND NOT EXISTS (SELECT 1 FROM distribution_records dr WHERE dr.order_id=o.id AND dr.status='SIGNED')`,
    [plans[0].id, cls.id]) : [{ c: 0 }];

  return (
    <>
      <div className="page-title">发放管理 <span className="muted small">{cls.name} · 分批发放与补领安排，缓解发放拥堵</span></div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <h3>创建发放/补领场次 <span className="sub">当前已到校未签收 {arrivedUnsigned[0].c} 人</span></h3>
        <form action={createDistribution}>
          <input type="hidden" name="redirect_to" value="/teacher/distributions" />
          <div className="form-grid">
            <div className="field">
              <label>订购计划</label>
              <select name="plan_id">{plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            </div>
            <div className="field">
              <label>类型</label>
              <select name="type"><option value="NORMAL">分批发放</option><option value="MAKEUP">补领专场</option></select>
            </div>
            <div className="field"><label>场次名称</label><input name="title" placeholder="如：第一批发放 / 放学前补领" /></div>
            <div className="field"><label>开始时间</label><input type="datetime-local" name="slot_start" required /></div>
            <div className="field"><label>结束时间</label><input type="datetime-local" name="slot_end" required /></div>
            <div className="field"><label>地点</label><input name="location" placeholder="如：校门大厅 / 总务处" /></div>
          </div>
          <div className="mt"><button className="btn sm" disabled={!plans.length}>创建场次并通知家长</button></div>
        </form>
      </div>
      <div className="card">
        <h3>发放场次</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>场次</th><th>类型</th><th>时间</th><th>地点</th><th>状态</th><th>签收/未到</th><th></th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td><Badge text={label(L.distType, d.type)} /></td>
                  <td className="nowrap">{fmtDT(d.slot_start)}</td>
                  <td>{d.location || '—'}</td>
                  <td><Badge text={label(L.distStatus, d.status)} /></td>
                  <td>{d.signed}/{d.total} 签收{d.missed ? `，${d.missed} 未到` : ''}</td>
                  <td><Link className="btn sm" href={`/teacher/distributions/${d.id}`}>现场登记</Link></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="muted">暂无发放场次</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
