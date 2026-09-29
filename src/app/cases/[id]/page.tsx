'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/fetch';
import { Badge, useToast, fmtMoney } from '@/components/ui';

const TYPE_LABELS: Record<string, string> = {
  exchange: '换码', resend: '补发', refund: '退款', complaint: '面料/质量投诉', transfer_cancel: '转学取消', wrong_claim: '错领处理',
};

export default function CaseDetailPage() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [staff, setStaff] = useState<any[]>([]);
  const { show, node } = useToast();
  const load = () => api(`/api/cases/${id}`).then(setD);
  useEffect(() => {
    api('/api/auth/me').then((r) => setMe(r.user));
    api('/api/users?role=after_sales').then((r) => setStaff(r.users)).catch(() => {});
    load();
  }, [id]);
  if (!d) return <div className="empty">加载中…</div>;
  const c = d.case;

  async function post(body: any, msg = '操作成功') {
    try {
      await api(`/api/cases/${id}`, { method: 'POST', body: JSON.stringify({ id: c.id, ...body }) });
      show(msg); load();
    } catch (e: any) { show(e.message, true); }
  }

  const trackingInput = (phase: string, label: string) => {
    const t = prompt(`${label}物流单号（可留空）`) ?? null;
    if (t === null) return;
    post({ action: flowAction(c.type), phase, tracking: t });
  };
  const flowAction = (t: string) => t === 'exchange' ? 'exchange' : 'resend';

  return (
    <div>
      {node}
      <div className="spread">
        <h2>售后工单 <span className="mono" style={{ fontSize: 13 }}>{c.case_no}</span></h2>
        <div className="row">
          {c.priority === 'high' && <Badge status="open" />}
          <Badge status={c.status} />
          <Link className="btn gray sm" href="/cases">返回列表</Link>
        </div>
      </div>
      <p>
        {TYPE_LABELS[c.type]} · 学生 <b>{c.student_name}</b>（{c.student_no} {c.class_name}）
        {c.order_no && <> · 订单 <Link className="mono" href={`/orders/${c.order_id}`}>{c.order_no}</Link></>}
      </p>
      <p className="muted">家长诉求：{c.description}</p>

      <div className="grid grid-2">
        <div className="card">
          <h2>协同处理</h2>

          {/* 分派 */}
          <div className="field">
            <label>处理人（售后客服/供应商/工厂）</label>
            <div className="row">
              <select id="assignee" defaultValue={c.assigned_to || ''}>
                <option value="">未分派</option>
                {staff.map((u) => <option key={u.id} value={u.id}>{u.real_name}（{u.username}）</option>)}
              </select>
              <button className="btn secondary sm" onClick={() => {
                const v = Number((document.getElementById('assignee') as HTMLSelectElement).value);
                if (v) post({ action: 'assign', assigned_to: v }, '已分派，工单进入处理中');
              }}>分派</button>
            </div>
          </div>

          {/* 换码流程 */}
          {c.type === 'exchange' && (
            <div>
              <h3>换码流程：家长寄回旧码 → 供应商重发新码 → 完成（订单明细尺码同步更新）</h3>
              {d.exchanges.map((e: any) => (
                <div key={e.id} className="card" style={{ background: '#fafbff' }}>
                  尺码 <b>{e.old_size} → {e.new_size}</b>　状态 <Badge status={e.status} />
                  <div className="row" style={{ marginTop: 8 }}>
                    {e.status === 'requested' && <button className="btn sm" onClick={() => trackingInput('returned', '家长寄回')}>① 登记旧码已寄回</button>}
                    {e.status === 'returned' && <button className="btn sm" onClick={() => trackingInput('reshipped', '供应商重发')}>② 供应商已重发新码</button>}
                    {e.status === 'reshipped' && <button className="btn sm" onClick={() => post({ action: 'exchange', phase: 'done', new_size: e.new_size, resolution: `换码完成：${e.old_size}→${e.new_size}` }, '换码完成，订单尺码已更新')}>③ 确认完成</button>}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    寄回单号：{e.return_tracking || '—'}　重发单号：{e.reship_tracking || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 补发流程 */}
          {(c.type === 'resend' || c.type === 'wrong_claim') && (
            <div>
              <h3>补发流程（工厂漏发/错领找不回）：补发请求 → 供应商发货 → 到校 → 发放闭环</h3>
              {!d.resends.length && (
                <button className="btn sm" onClick={() => {
                  const size = prompt('补发尺码（如 130 / 34）', '130') || '';
                  const qty = Number(prompt('补发数量', '1') || '1');
                  if (size) post({ action: 'resend', phase: 'request', size, qty, order_item_id: c.order_item_id });
                }}>登记补发请求</button>
              )}
              {d.resends.map((r: any) => (
                <div key={r.id} className="card" style={{ background: '#fafbff' }}>
                  补发 {r.name || ''} {r.size} × {r.qty}　状态 <Badge status={r.status} />
                  <div className="row" style={{ marginTop: 8 }}>
                    {r.status === 'requested' && <button className="btn sm" onClick={() => trackingInput('shipped', '补发')}>供应商已发货</button>}
                    {r.status === 'shipped' && <button className="btn sm" onClick={() => post({ action: 'resend', phase: 'arrived' }, '补发到校')}>确认到校</button>}
                    {r.status === 'arrived' && <button className="btn sm" onClick={() => post({ action: 'resend', phase: 'done', resolution: '补发已发放给学生' }, '补发完成，缺件/错领记录已闭环')}>安排补领并完成</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 退款流程 */}
          {(c.type === 'refund' || c.type === 'transfer_cancel' || c.type === 'complaint') && (
            <div>
              <h3>退款流程：申请 → 总务批准 → 已退款（转学/迟缴取消/过敏退货）</h3>
              {!d.refunds.length && c.type !== 'transfer_cancel' && (
                <button className="btn sm" onClick={() => {
                  const amount = Number(prompt('退款金额', '0') || '0');
                  if (amount > 0) post({ action: 'refund', phase: 'request', amount });
                }}>登记退款申请</button>
              )}
              {d.refunds.map((r: any) => (
                <div key={r.id} className="card" style={{ background: '#fafbff' }}>
                  退款 <b>{fmtMoney(r.amount)}</b>（{r.reason}）　状态 <Badge status={r.status} />
                  <div className="row" style={{ marginTop: 8 }}>
                    {r.status === 'requested' && <>
                      <button className="btn sm" onClick={() => post({ action: 'refund', phase: 'approve' }, '退款已批准')}>总务批准</button>
                      <button className="btn danger sm" onClick={() => { const reason = prompt('驳回原因') || ''; post({ action: 'refund', phase: 'reject', reason }); }}>驳回</button>
                    </>}
                    {r.status === 'approved' && <button className="btn sm" onClick={() => post({ action: 'refund', phase: 'refunded', resolution: `退款 ${fmtMoney(r.amount)} 已原路退回` }, '退款完成')}>确认已退款</button>}
                  </div>
                </div>
              ))}
              {/* 转学工单种子自带 requested 退款，上面按钮即可继续 */}
            </div>
          )}

          {/* 投诉处理 */}
          {c.type === 'complaint' && (
            <div style={{ marginTop: 10 }}>
              <h3>面料过敏投诉处理</h3>
              <button className="btn sm" onClick={() => {
                const resolution = prompt('处理结论（检测结果/退换方案）', '已送第三方检测，面料合格，为该生提供无荧光纯棉换购并退款') || '';
                if (resolution) post({ action: 'resolve', resolution }, '投诉已处理并归档，纳入供应商考核');
              }}>登记检测结论并解决</button>
            </div>
          )}

          {c.status === 'open' && (
            <div style={{ marginTop: 10 }}>
              <button className="btn danger sm" onClick={() => { const reason = prompt('不予处理原因') || ''; if (reason) post({ action: 'reject', reason }); }}>驳回工单</button>
            </div>
          )}
        </div>

        <div className="card">
          <h2>该学生全过程时间线（同一学生 · 同一批校服）</h2>
          <div className="timeline" style={{ maxHeight: 460, overflow: 'auto' }}>
            {d.logs.map((l: any) => (
              <div className="ev" key={l.id}>
                <div><b>{l.action}</b> <span className="muted">— {l.actor_name}（{l.actor_role}）</span></div>
                {l.detail && <div className="muted">{l.detail}</div>}
                <div className="t">{l.created_at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
