'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/fetch';
import { Badge, useToast } from '@/components/ui';

export default function ProductionBlockersPage() {
  const [blocked, setBlocked] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  useEffect(() => { api('/api/dashboard/production-blockers').then((d) => { setBlocked(d.blocked); setSummary(d.summary); }); }, []);

  return (
    <div>
      <h2>供应商投产看板：哪些订单还不能进入生产</h2>
      <div className="grid grid-4">
        {summary.map((s: any) => (
          <div className="stat" key={s.status}>
            <div className="num">{s.cnt}</div>
            <div className="lbl">订单状态 <Badge status={s.status} /> · 共 {s.qty} 件</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>阻塞订单明细与原因</h2>
        <table>
          <thead><tr><th>订单号</th><th>学生</th><th>班级</th><th>计划</th><th>件数</th><th>不能投产的原因</th></tr></thead>
          <tbody>
            {blocked.map((b: any) => (
              <tr key={b.id}>
                <td className="mono">{b.order_no}</td><td>{b.student_name}</td><td>{b.class_name}</td>
                <td>{b.plan_name}</td><td>{b.total_qty}</td>
                <td><span style={{ color: 'var(--red)' }}>⛔ {b.block_reason}</span></td>
              </tr>
            ))}
            {!blocked.length && <tr><td colSpan={6} className="empty">没有阻塞订单，全部可投产</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
