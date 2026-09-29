import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { q } from '../../../../lib/db';
import { createPlan } from '../../../../lib/actions/admin';
import { L, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function PlansPage({ searchParams }) {
  await requireUser(['ADMIN']);
  const plans = await q(
    `SELECT p.*, c.name AS campus_name,
       (SELECT COUNT(*) FROM orders o WHERE o.plan_id=p.id AND o.status='CONFIRMED') AS orders,
       (SELECT COUNT(*) FROM orders o WHERE o.plan_id=p.id AND o.pay_status='PAID') AS paid,
       (SELECT COUNT(*) FROM plan_classes pc WHERE pc.plan_id=p.id) AS classes
     FROM order_plans p JOIN campuses c ON c.id=p.campus_id ORDER BY p.id DESC`);
  const campuses = await q('SELECT * FROM campuses ORDER BY id');
  const classes = await q(
    `SELECT c.id, c.name, g.name AS grade_name, cp.name AS campus_name FROM classes c
     JOIN grades g ON g.id=c.grade_id JOIN campuses cp ON cp.id=g.campus_id ORDER BY cp.id, c.id`);

  return (
    <>
      <div className="page-title">订购计划</div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <h3>新建订购计划 <span className="sub">按校区/年级/班级组织，支持多校区统一采购与毕业班补订</span></h3>
        <form action={createPlan}>
          <div className="form-grid">
            <div className="field"><label>计划名称</label><input name="title" required placeholder="如：2026年秋季校服订购" /></div>
            <div className="field">
              <label>校区</label>
              <select name="campus_id">{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <div className="field">
              <label>季节</label>
              <select name="season">{['春季', '夏季', '秋季', '冬季'].map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="field"><label>缴费截止日</label><input type="date" name="pay_deadline" /></div>
            <div className="field"><label>贫困生减免比例（%）</label><input type="number" name="poverty_discount" defaultValue={50} min={0} max={100} /></div>
            <div className="field"><label>备注</label><input name="remark" placeholder="如：含毕业班补订" /></div>
          </div>
          <div className="field mt">
            <label>覆盖班级（可多选）</label>
            <div className="checks">
              {classes.map((c) => (
                <label key={c.id}><input type="checkbox" name="class_ids" value={c.id} /> {c.campus_name}·{c.name}</label>
              ))}
            </div>
          </div>
          <div className="mt"><button className="btn sm">创建计划</button></div>
        </form>
      </div>
      <div className="card">
        <h3>计划列表</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>计划</th><th>校区</th><th>季节</th><th>状态</th><th>班级数</th><th>订单/已缴费</th><th>缴费截止</th><th></th></tr></thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{p.campus_name}</td>
                  <td>{p.season}</td>
                  <td><Badge text={label(L.planStatus, p.status)} /></td>
                  <td>{p.classes}</td>
                  <td>{p.orders} / {p.paid}</td>
                  <td>{p.pay_deadline || '—'}</td>
                  <td><Link className="btn sm" href={`/admin/plans/${p.id}`}>管理</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
