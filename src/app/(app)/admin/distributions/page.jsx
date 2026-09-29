import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { q } from '../../../../lib/db';
import { createDistribution } from '../../../../lib/actions/teacher';
import { L, fmtDT, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function AdminDistributions({ searchParams }) {
  await requireUser(['ADMIN']);
  const plans = await q('SELECT id, title FROM order_plans WHERE status NOT IN (\'DRAFT\',\'CLOSED\') ORDER BY id DESC');
  const classes = await q(
    `SELECT c.id, c.name, cp.name AS campus_name FROM classes c
     JOIN grades g ON g.id=c.grade_id JOIN campuses cp ON cp.id=g.campus_id ORDER BY cp.id, c.id`);
  const list = await q(
    `SELECT d.*, c.name AS class_name, p.title AS plan_title,
       (SELECT COUNT(*) FROM distribution_records dr WHERE dr.distribution_id=d.id) AS total,
       (SELECT COUNT(*) FROM distribution_records dr WHERE dr.distribution_id=d.id AND dr.status='SIGNED') AS signed,
       (SELECT COUNT(*) FROM distribution_records dr WHERE dr.distribution_id=d.id AND dr.status='MISSED') AS missed
     FROM distributions d JOIN classes c ON c.id=d.class_id JOIN order_plans p ON p.id=d.plan_id
     ORDER BY d.slot_start DESC`);

  return (
    <>
      <div className="page-title">发放管理 <span className="muted small">分批发放与补领安排，缓解换码高峰与到校发放拥堵</span></div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <h3>创建发放场次（任意班级）</h3>
        <form action={createDistribution}>
          <input type="hidden" name="redirect_to" value="/admin/distributions" />
          <div className="form-grid">
            <div className="field">
              <label>订购计划</label>
              <select name="plan_id">{plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
            </div>
            <div className="field">
              <label>班级</label>
              <select name="class_id">{classes.map((c) => <option key={c.id} value={c.id}>{c.campus_name}·{c.name}</option>)}</select>
            </div>
            <div className="field">
              <label>类型</label>
              <select name="type"><option value="NORMAL">分批发放</option><option value="MAKEUP">补领专场</option></select>
            </div>
            <div className="field"><label>场次名称</label><input name="title" placeholder="如：第二批发放" /></div>
            <div className="field"><label>开始时间</label><input type="datetime-local" name="slot_start" required /></div>
            <div className="field"><label>结束时间</label><input type="datetime-local" name="slot_end" required /></div>
            <div className="field"><label>地点</label><input name="location" /></div>
          </div>
          <div className="mt"><button className="btn sm">创建场次</button></div>
        </form>
      </div>
      <div className="card">
        <h3>全部发放场次</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>计划</th><th>班级</th><th>场次</th><th>类型</th><th>时间</th><th>状态</th><th>签收/总数</th><th>未到</th><th></th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td className="small">{d.plan_title}</td>
                  <td>{d.class_name}</td>
                  <td>{d.title}</td>
                  <td><Badge text={label(L.distType, d.type)} /></td>
                  <td className="nowrap small">{fmtDT(d.slot_start)}</td>
                  <td><Badge text={label(L.distStatus, d.status)} /></td>
                  <td>{d.signed}/{d.total}</td>
                  <td>{d.missed > 0 ? <Badge text={d.missed} tone="danger" /> : 0}</td>
                  <td><Link className="btn sm" href={`/teacher/distributions/${d.id}`}>登记</Link></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={9} className="muted">暂无发放场次</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
