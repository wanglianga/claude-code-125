'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetch';
import { Badge } from '@/components/ui';

const TYPE_LABELS: Record<string, string> = {
  exchange: '换码', resend: '补发', refund: '退款', complaint: '投诉', transfer_cancel: '转学取消', wrong_claim: '错领',
};
const REASON_LABELS: Record<string, string> = {
  growth: '成长过快', fitting_deviation: '试穿尺码偏差', factory_missing: '工厂漏发',
  wrong_class_claim: '班级错领', allergy: '面料过敏', late_payment: '迟缴费', transfer: '转学', other: '其他',
};

export default function CasesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    api(`/api/cases${status ? `?status=${status}` : ''}`).then((d) => setRows(d.cases));
  }, [status]);

  return (
    <div>
      <div className="spread">
        <h2>售后工单（总务 · 班主任 · 家长 · 供应商 · 工厂 · 客服协同）</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部</option>
          {['open', 'processing', 'resolved', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="card">
        <table>
          <thead><tr>
            <th>工单号</th><th>学生</th><th>班级</th><th>类型</th><th>原因</th><th>优先级</th><th>状态</th>
            <th>描述</th><th>处理人</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} style={c.priority === 'high' && c.status !== 'resolved' ? { background: '#fffbf5' } : undefined}>
                <td className="mono">{c.case_no}</td><td>{c.student_name}</td><td>{c.campus_name} {c.class_name}</td>
                <td><b>{TYPE_LABELS[c.type]}</b></td><td>{REASON_LABELS[c.reason]}</td>
                <td>{c.priority === 'high' ? <span style={{ color: 'var(--red)' }}>高</span> : '普通'}</td>
                <td><Badge status={c.status} /></td><td style={{ maxWidth: 260 }}>{c.description}</td>
                <td>{c.assignee_name || <span className="muted">未分派</span>}</td>
                <td><Link className="btn secondary sm" href={`/cases/${c.id}`}>处理 ›</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="empty">暂无工单</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
