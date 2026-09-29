import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { one, q } from '../../../../lib/db';
import { createFittingSession } from '../../../../lib/actions/teacher';
import { fmtDT } from '../../../../lib/util';
import { Msg } from '../../../../components/ui';

export default async function FittingsPage({ searchParams }) {
  const user = await requireUser(['TEACHER']);
  const cls = await one('SELECT * FROM classes WHERE teacher_id=?', [user.id]);
  if (!cls) return <div className="card">您尚未绑定班级。</div>;
  const plans = await q(
    `SELECT p.* FROM order_plans p JOIN plan_classes pc ON pc.plan_id=p.id
     WHERE pc.class_id=? AND p.status NOT IN ('DRAFT','CLOSED','COMPLETED') ORDER BY p.id DESC`, [cls.id]);
  const sessions = await q(
    `SELECT fs.*, p.title AS plan_title,
       (SELECT COUNT(*) FROM fitting_records fr WHERE fr.session_id=fs.id) AS recorded,
       (SELECT COUNT(*) FROM students s WHERE s.class_id=fs.class_id AND s.status='ACTIVE') AS total
     FROM fitting_sessions fs JOIN order_plans p ON p.id=fs.plan_id
     WHERE fs.class_id=? ORDER BY fs.slot_start DESC`, [cls.id]);

  return (
    <>
      <div className="page-title">试穿管理 <span className="muted small">{cls.name}</span></div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <h3>创建试穿时段</h3>
        <form action={createFittingSession}>
          <input type="hidden" name="redirect_to" value="/teacher/fittings" />
          <div className="form-grid">
            <div className="field">
              <label>订购计划</label>
              <select name="plan_id">
                {plans.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="field"><label>开始时间</label><input type="datetime-local" name="slot_start" required /></div>
            <div className="field"><label>结束时间</label><input type="datetime-local" name="slot_end" required /></div>
            <div className="field"><label>地点</label><input name="location" placeholder="如：体育馆" /></div>
          </div>
          <div className="mt"><button className="btn sm" disabled={!plans.length}>创建并通知家长</button></div>
        </form>
      </div>
      <div className="card">
        <h3>试穿时段</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>计划</th><th>时间</th><th>地点</th><th>录入进度</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.plan_title}</td>
                  <td className="nowrap">{fmtDT(s.slot_start)} ~ {fmtDT(s.slot_end).slice(11)}</td>
                  <td>{s.location || '—'}</td>
                  <td>{s.recorded}/{s.total}</td>
                  <td><Link className="btn sm" href={`/teacher/fittings/${s.id}`}>录入/查看记录</Link></td>
                </tr>
              ))}
              {sessions.length === 0 && <tr><td colSpan={5} className="muted">暂无试穿时段</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
