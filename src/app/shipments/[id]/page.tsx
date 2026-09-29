'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/fetch';
import { Badge, useToast } from '@/components/ui';

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [arrived, setArrived] = useState<Record<number, number>>({});
  const { show, node } = useToast();
  const load = () => api(`/api/shipments/${id}`).then((r) => {
    setD(r);
    const m: any = {};
    for (const l of r.lines) m[l.id] = l.arrived_qty || 0;
    setArrived(m);
  });
  useEffect(() => { load(); }, [id]);
  if (!d) return <div className="empty">加载中…</div>;
  const sh = d.shipment;
  const isGA = true; // 页面按角色显示按钮由接口控制；这里展示给总务

  return (
    <div>
      {node}
      <div className="spread">
        <h2>发货单 <span className="mono" style={{ fontSize: 14 }}>{sh.shipment_no}</span></h2>
        <div className="row"><Badge status={sh.status} /><Link className="btn gray sm" href="/shipments">返回</Link></div>
      </div>
      <p className="muted">批次 {sh.batch_no} · {sh.carrier} {sh.tracking_no} · 预计到校 {sh.expected_arrival}</p>

      <div className="card">
        <h2>逐件到校确认（实际到校数少于发货数 = 工厂漏发）</h2>
        <table>
          <thead><tr><th>学生</th><th>班级</th><th>品类</th><th>尺码</th><th>发货数</th><th>实际到校</th><th>状态</th></tr></thead>
          <tbody>
            {d.lines.map((l: any) => {
              const miss = l.qty - (arrived[l.id] ?? 0);
              return (
                <tr key={l.id}>
                  <td>{l.student_name}（{l.student_no}）</td><td>{l.class_name}</td>
                  <td>{l.item_name}</td><td>{l.size}</td><td>{l.qty}</td>
                  <td><input style={{ width: 80 }} type="number" min={0} max={l.qty} value={arrived[l.id] ?? 0}
                    disabled={sh.status === 'arrived'}
                    onChange={(e) => setArrived({ ...arrived, [l.id]: Number(e.target.value) })} /></td>
                  <td>{sh.status === 'arrived' ? (
                    miss > 0 ? <Badge status="missing" /> : <Badge status="arrived" />
                  ) : miss > 0 ? <span style={{ color: 'var(--red)' }}>将登记漏发 {miss} 件</span> : <span className="muted">齐套</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sh.status !== 'arrived' && (
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <button className="btn" onClick={async () => {
              const lines = d.lines.map((l: any) => ({ id: l.id, arrived_qty: arrived[l.id] ?? 0 }));
              try {
                await api(`/api/shipments/${id}`, { method: 'POST', body: JSON.stringify({ id: sh.id, lines }) });
                show('已确认到校，漏发件已记录并提示发起补发'); load();
              } catch (e: any) { show(e.message, true); }
            }}>确认到校</button>
          </div>
        )}
      </div>
    </div>
  );
}
