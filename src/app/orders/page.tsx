'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetch';
import { Badge, Modal, useToast, fmtMoney } from '@/components/ui';

export default function OrdersPage() {
  const [me, setMe] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [planId, setPlanId] = useState('');
  const [status, setStatus] = useState('');
  const [holdFor, setHoldFor] = useState<any>(null);
  const { show, node } = useToast();

  const load = () => {
    const qs = new URLSearchParams();
    if (planId) qs.set('plan_id', planId);
    if (status) qs.set('status', status);
    api(`/api/orders?${qs}`).then((d) => setOrders(d.orders));
  };
  useEffect(() => {
    api('/api/auth/me').then((d) => setMe(d.user));
    api('/api/plans').then((d) => setPlans(d.plans));
  }, []);
  useEffect(load, [planId, status]);

  const isGA = me && ['general_affairs', 'admin'].includes(me.role);

  async function act(id: number, action: string, extra: any = {}) {
    const r = await api(`/api/orders/${id}`, { method: 'POST', body: JSON.stringify({ id, action, ...extra }) });
    show('操作成功'); load();
    return r;
  }

  return (
    <div>
      {node}
      <div className="spread">
        <h2>订单与缴费</h2>
        <div className="row">
          <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">全部计划</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            {['draft', 'confirmed', 'paid', 'hold', 'cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="card">
        <table>
          <thead><tr>
            <th>订单号</th><th>学生</th><th>班级</th><th>计划</th><th>状态</th><th>金额</th>
            <th>品类件数</th><th>已发/已签收</th><th>操作</th>
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`} className="mono">{o.order_no}</Link></td>
                <td>{o.student_name}<div className="muted" style={{ fontSize: 11 }}>{o.student_no}</div></td>
                <td>{o.class_name}</td><td>{o.plan_name}</td>
                <td><Badge status={o.status} />{o.hold_reason && <div className="muted" style={{ fontSize: 11, color: 'var(--red)' }}>{o.hold_reason}</div>}</td>
                <td>
                  应付 <b>{fmtMoney(o.due_amount)}</b>
                  {Number(o.subsidy_amount) > 0 && <div className="muted" style={{ fontSize: 11, color: 'var(--green)' }}>减免 {fmtMoney(o.subsidy_amount)}</div>}
                </td>
                <td>{o.progress?.kinds || 0} 种 / {o.progress?.total_qty || 0} 件</td>
                <td>{o.progress?.shipped_qty || 0} / {o.progress?.signed_qty || 0}</td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {o.status === 'draft' && <button className="btn sm" onClick={() => act(o.id, 'confirm')}>确认订单</button>}
                    {(o.status === 'confirmed' || o.status === 'hold') && (
                      <button className="btn sm" onClick={async () => {
                        try { const r = await act(o.id, 'pay'); if (r.late) show('该订单已超过订购截止日期（迟缴费），已通知总务跟进'); } catch (e: any) { show(e.message, true); }
                      }}>缴费</button>
                    )}
                    {isGA && (o.status === 'confirmed' || o.status === 'paid') &&
                      <button className="btn secondary sm" onClick={() => setHoldFor(o)}>挂起</button>}
                    {isGA && o.status === 'hold' && <button className="btn secondary sm" onClick={() => act(o.id, 'release')}>解除挂起</button>}
                    {isGA && o.status !== 'cancelled' && <button className="btn danger sm" onClick={() => {
                      const reason = prompt('取消原因（可选）') || '';
                      if (reason !== null) act(o.id, 'cancel', { reason }).catch((e) => show(e.message, true));
                    }}>取消</button>}
                  </div>
                </td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={9} className="empty">暂无订单</td></tr>}
          </tbody>
        </table>
      </div>

      {holdFor && (
        <Modal title={`挂起订单 · ${holdFor.order_no}`} onClose={() => setHoldFor(null)}>
          <p className="muted">挂起后该订单不能进入生产，供应商端会明确看到阻塞原因（如迟缴费待核实、转学处理中等）。</p>
          <div className="field"><label>挂起原因</label>
            <select id="holdReason">
              <option>迟缴费待核实</option><option>学生转学处理中</option><option>尺码信息待补充</option><option>学校暂缓</option>
            </select>
          </div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn" onClick={async () => {
              const reason = (document.getElementById('holdReason') as HTMLSelectElement).value;
              await act(holdFor.id, 'hold', { reason }); setHoldFor(null);
            }}>确认挂起</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
