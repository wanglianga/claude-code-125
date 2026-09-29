import { requireUser } from '../../../../lib/session';
import { q } from '../../../../lib/db';
import { createAssessment } from '../../../../lib/actions/admin';
import { fmtDT } from '../../../../lib/util';
import { Msg } from '../../../../components/ui';

export default async function AssessmentsPage({ searchParams }) {
  await requireUser(['ADMIN']);
  const suppliers = await q('SELECT * FROM suppliers ORDER BY id');
  const batches = await q('SELECT id, batch_no, supplier_id FROM production_batches ORDER BY id DESC');
  const list = await q(
    `SELECT a.*, s.name AS supplier_name, b.batch_no, u.name AS creator
     FROM supplier_assessments a
     JOIN suppliers s ON s.id=a.supplier_id
     LEFT JOIN production_batches b ON b.id=a.batch_id
     LEFT JOIN users u ON u.id=a.created_by
     ORDER BY a.id DESC`);
  const avg = await q(
    `SELECT s.name, COUNT(a.id) AS cnt,
       ROUND(AVG(a.score_quality),1) AS q, ROUND(AVG(a.score_timeliness),1) AS t, ROUND(AVG(a.score_service),1) AS sv
     FROM suppliers s LEFT JOIN supplier_assessments a ON a.supplier_id=s.id GROUP BY s.id, s.name`);

  return (
    <>
      <div className="page-title">供应商考核</div>
      <Msg searchParams={searchParams} />
      <div className="grid cols-3 mb">
        {avg.map((s) => (
          <div className="stat" key={s.name}>
            <div className="num" style={{ fontSize: 18 }}>{s.name}</div>
            <div className="lbl">
              考核 {s.cnt} 次 · 质量 {s.q ?? '—'} · 交期 {s.t ?? '—'} · 服务 {s.sv ?? '—'}
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>新增考核记录</h3>
        <form action={createAssessment}>
          <div className="form-grid">
            <div className="field">
              <label>供应商</label>
              <select name="supplier_id">{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>
            <div className="field">
              <label>关联批次（可选）</label>
              <select name="batch_id">
                <option value="">—</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_no}</option>)}
              </select>
            </div>
            <div className="field"><label>质量评分（1-5）</label><input type="number" name="score_quality" min="1" max="5" required /></div>
            <div className="field"><label>交期评分（1-5）</label><input type="number" name="score_timeliness" min="1" max="5" required /></div>
            <div className="field"><label>服务评分（1-5）</label><input type="number" name="score_service" min="1" max="5" required /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}><label>评语</label><input name="comment" placeholder="如：到货及时，个别包装破损" /></div>
          </div>
          <div className="mt"><button className="btn sm">保存考核</button></div>
        </form>
      </div>
      <div className="card">
        <h3>考核记录</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>供应商</th><th>批次</th><th>质量</th><th>交期</th><th>服务</th><th>评语</th><th>考核人</th><th>时间</th></tr></thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.supplier_name}</td>
                  <td>{a.batch_no || '—'}</td>
                  <td>{a.score_quality}</td>
                  <td>{a.score_timeliness}</td>
                  <td>{a.score_service}</td>
                  <td className="small">{a.comment || '—'}</td>
                  <td className="small">{a.creator || '—'}</td>
                  <td className="small nowrap">{fmtDT(a.created_at)}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={8} className="muted">暂无考核记录</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
