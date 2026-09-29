import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { q } from '../../../../lib/db';
import { L, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function BatchesPage({ searchParams }) {
  await requireUser(['ADMIN']);
  const batches = await q(
    `SELECT b.*, s.name AS supplier_name, p.title AS plan_title,
       (SELECT COUNT(*) FROM orders o WHERE o.batch_id=b.id) AS orders,
       (SELECT COUNT(*) FROM shipments sh WHERE sh.batch_id=b.id) AS shipments
     FROM production_batches b JOIN suppliers s ON s.id=b.supplier_id JOIN order_plans p ON p.id=b.plan_id
     ORDER BY b.id DESC`);

  return (
    <>
      <div className="page-title">生产批次</div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>批次号</th><th>计划</th><th>供应商</th><th>状态</th><th>订单数</th><th>发货单</th><th>预计到校</th><th></th></tr></thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.batch_no}</td>
                  <td className="small">{b.plan_title}</td>
                  <td>{b.supplier_name}</td>
                  <td><Badge text={label(L.batchStatus, b.status)} /></td>
                  <td>{b.orders}</td>
                  <td>{b.shipments}</td>
                  <td>{b.expected_arrival || '—'}</td>
                  <td><Link className="btn sm" href={`/admin/batches/${b.id}`}>详情</Link></td>
                </tr>
              ))}
              {batches.length === 0 && <tr><td colSpan={8} className="muted">暂无批次，请到订购计划中创建</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
