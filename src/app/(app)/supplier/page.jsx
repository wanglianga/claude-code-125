import Link from 'next/link';
import { requireUser } from '../../../lib/session';
import { q, one } from '../../../lib/db';
import { planReadiness } from '../../../lib/queries';
import { L, fmtDT, label } from '../../../lib/util';
import { Badge, Msg, Stat } from '../../../components/ui';

export default async function SupplierHome({ searchParams }) {
  const user = await requireUser(['SUPPLIER']);
  const batches = await q(
    `SELECT b.*, p.title AS plan_title,
       (SELECT COUNT(*) FROM orders o WHERE o.batch_id=b.id) AS orders,
       (SELECT COUNT(*) FROM shipments sh WHERE sh.batch_id=b.id) AS shipments
     FROM production_batches b JOIN order_plans p ON p.id=b.plan_id
     WHERE b.supplier_id=? ORDER BY b.id DESC`, [user.supplier_id]);
  const assessments = await q(
    `SELECT a.*, b.batch_no FROM supplier_assessments a LEFT JOIN production_batches b ON b.id=a.batch_id
     WHERE a.supplier_id=? ORDER BY a.id DESC LIMIT 10`, [user.supplier_id]);
  // 各计划投产就绪情况（供应商明确哪些订单不能投产）
  const planIds = [...new Set(batches.map((b) => b.plan_id))];
  const readinessByPlan = [];
  for (const pid of planIds) {
    const plan = await one('SELECT id, title FROM order_plans WHERE id=?', [pid]);
    const r = await planReadiness(pid);
    readinessByPlan.push({ plan, ...r });
  }
  const supplier = await one('SELECT * FROM suppliers WHERE id=?', [user.supplier_id]);

  return (
    <>
      <div className="page-title">供应商工作台 <span className="muted small">{supplier?.name}</span></div>
      <Msg searchParams={searchParams} />
      <div className="grid cols-4 mb">
        <Stat num={batches.length} label="生产批次" />
        <Stat num={batches.filter((b) => ['PENDING', 'IN_PRODUCTION'].includes(b.status)).length} label="待投产/生产中" />
        <Stat num={batches.filter((b) => ['PRODUCED', 'SHIPPING'].includes(b.status)).length} label="待发货/发货中" />
        <Stat num={assessments.length} label="考核记录" />
      </div>

      <div className="card">
        <h3>生产批次</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>批次号</th><th>计划</th><th>状态</th><th>订单数</th><th>发货单</th><th>预计到校</th><th></th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.batch_no}</td>
                  <td className="small">{b.plan_title}</td>
                  <td><Badge text={label(L.batchStatus, b.status)} /></td>
                  <td>{b.orders}</td>
                  <td>{b.shipments}</td>
                  <td>{b.expected_arrival || '—'}</td>
                  <td><Link className="btn sm" href={`/supplier/batches/${b.id}`}>处理</Link></td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={7} className="muted">暂无下达给贵司的批次</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {readinessByPlan.map(({ plan, ready, unpaid, unconfirmed }) => (
        <div className="card" key={plan.id}>
          <h3>投产就绪 · {plan.title} <span className="sub">以下订单暂不能进入生产</span></h3>
          <div className="grid cols-3">
            <div>
              <h3 className="small">✅ 可投产待入批（{ready.length}）</h3>
              <ul className="small">
                {ready.map((o) => <li key={o.id}>{o.class_name} {o.student_name}（{o.order_no}）</li>)}
                {!ready.length && <li className="muted">无</li>}
              </ul>
            </div>
            <div>
              <h3 className="small">⛔ 未缴费，不能投产（{unpaid.length}）</h3>
              <ul className="small">
                {unpaid.map((o) => <li key={o.id}>{o.class_name} {o.student_name}（{o.order_no}）</li>)}
                {!unpaid.length && <li className="muted">无</li>}
              </ul>
            </div>
            <div>
              <h3 className="small">⛔ 家长未确认订单（{unconfirmed.length}）</h3>
              <ul className="small">
                {unconfirmed.map((s) => <li key={s.id}>{s.class_name} {s.student_name}</li>)}
                {!unconfirmed.length && <li className="muted">无</li>}
              </ul>
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <h3>学校考核记录</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>批次</th><th>质量</th><th>交期</th><th>服务</th><th>评语</th><th>时间</th></tr></thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id}>
                  <td>{a.batch_no || '—'}</td>
                  <td>{a.score_quality}</td>
                  <td>{a.score_timeliness}</td>
                  <td>{a.score_service}</td>
                  <td className="small">{a.comment || '—'}</td>
                  <td className="small nowrap">{fmtDT(a.created_at)}</td>
                </tr>
              ))}
              {assessments.length === 0 && <tr><td colSpan={6} className="muted">暂无考核记录</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
