import { requireUser } from '../../../lib/session';
import { q } from '../../../lib/db';
import { updateBatchProgress } from '../../../lib/actions/factory';
import { L, label } from '../../../lib/util';
import { Badge, Msg, Stat } from '../../../components/ui';

export default async function FactoryHome({ searchParams }) {
  await requireUser(['FACTORY']);
  const batches = await q(
    `SELECT b.*, s.name AS supplier_name, p.title AS plan_title,
       (SELECT COUNT(*) FROM orders o WHERE o.batch_id=b.id) AS orders
     FROM production_batches b JOIN suppliers s ON s.id=b.supplier_id JOIN order_plans p ON p.id=b.plan_id
     WHERE b.status NOT IN ('CLOSED') ORDER BY b.id DESC`);
  const sizeAggByBatch = {};
  for (const b of batches) {
    sizeAggByBatch[b.id] = await q(
      `SELECT oi.item_name, oi.size, SUM(oi.qty) AS qty FROM order_items oi
       JOIN orders o ON o.id=oi.order_id WHERE o.batch_id=? AND o.status='CONFIRMED'
       GROUP BY oi.item_name, oi.size ORDER BY oi.item_name, oi.size`, [b.id]);
  }

  return (
    <>
      <div className="page-title">工厂工作台</div>
      <Msg searchParams={searchParams} />
      <div className="grid cols-3 mb">
        <Stat num={batches.filter((b) => b.status === 'PENDING').length} label="待投产批次" />
        <Stat num={batches.filter((b) => b.status === 'IN_PRODUCTION').length} label="生产中" />
        <Stat num={batches.filter((b) => ['PRODUCED', 'SHIPPING', 'ARRIVED'].includes(b.status)).length} label="已完成/发货" />
      </div>
      {batches.map((b) => (
        <div className="card" key={b.id}>
          <div className="between mb">
            <div>
              <b>{b.batch_no}</b> <Badge text={label(L.batchStatus, b.status)} />{' '}
              <span className="muted small">{b.plan_title} · {b.supplier_name} · {b.orders} 笔订单 · 预计到校 {b.expected_arrival || '待定'}</span>
            </div>
            <form action={updateBatchProgress} className="flex">
              <input type="hidden" name="batch_id" value={b.id} />
              <select name="status" defaultValue={b.status === 'PRODUCED' ? 'PRODUCED' : 'IN_PRODUCTION'}>
                <option value="IN_PRODUCTION">开始生产</option>
                <option value="PRODUCED">生产完成</option>
              </select>
              <input type="date" name="expected_arrival" defaultValue={b.expected_arrival || ''} />
              <button className="btn sm">更新进度</button>
            </form>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>项目</th><th>尺码</th><th>数量</th></tr></thead>
              <tbody>
                {(sizeAggByBatch[b.id] || []).map((r, i) => (
                  <tr key={i}><td>{r.item_name}</td><td><b>{r.size}</b></td><td>{r.qty}</td></tr>
                ))}
                {!sizeAggByBatch[b.id]?.length && <tr><td colSpan={3} className="muted">暂无生产明细</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {batches.length === 0 && <div className="card muted">暂无生产批次。</div>}
    </>
  );
}
