'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetch';
import { Badge } from '@/components/ui';

export default function ShipmentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/api/shipments').then((d) => setRows(d.shipments)); }, []);
  return (
    <div>
      <h2>供应商分批发货 / 到校确认</h2>
      <p className="muted">供应商可将一个批次分多批发货；总务按每批逐件确认实际到校数量，少于发货数即为工厂漏发，自动留痕并进入补发流程。</p>
      <div className="card">
        <table>
          <thead><tr><th>发货单号</th><th>批次</th><th>计划</th><th>物流</th><th>发货时间</th><th>预计到校</th><th>状态</th><th>数量(发/到/漏)</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.shipment_no}</td><td>{s.batch_no}</td><td>{s.plan_name}</td>
                <td>{s.carrier} {s.tracking_no}</td><td>{s.shipped_at}</td><td>{s.expected_arrival}</td>
                <td><Badge status={s.status} /></td>
                <td>{s.ship_qty}/{s.arrived_qty}/{s.missing_qty}</td>
                <td><Link className="btn secondary sm" href={`/shipments/${s.id}`}>明细/到校确认 ›</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={9} className="empty">暂无发货单</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
