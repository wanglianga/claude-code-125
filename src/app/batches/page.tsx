'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetch';
import { Badge, Modal, useToast } from '@/components/ui';

export default function BatchesPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const { show, node } = useToast();
  const load = () => api('/api/batches').then((d) => setBatches(d.batches));
  useEffect(() => { load(); }, []);

  return (
    <div>
      {node}
      <div className="spread">
        <h2>工厂生产批次</h2>
        <button className="btn" onClick={() => setShowCreate(true)}>＋ 创建生产批次</button>
      </div>
      <p className="muted">只有<b>已缴费且学生在校</b>的订单才能进入生产；待缴费、挂起、转学的订单在“投产限制”中列明。系统按缴费先后自动把批次数量分配到学生订单。</p>
      <div className="card">
        <table>
          <thead><tr><th>批次号</th><th>计划</th><th>批次名称</th><th>状态</th><th>计划/已报产</th><th>发货次数</th><th>预计到校</th><th></th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="mono">{b.batch_no}</td><td>{b.plan_name}</td><td>{b.name}</td>
                <td><Badge status={b.status} /></td>
                <td>{b.produced_qty}/{b.plan_qty} 件</td><td>{b.shipment_count}</td>
                <td>{b.expected_arrival || '—'}</td>
                <td><Link className="btn secondary sm" href={`/batches/${b.id}`}>批次详情 ›</Link></td>
              </tr>
            ))}
            {!batches.length && <tr><td colSpan={8} className="empty">暂无批次</td></tr>}
          </tbody>
        </table>
      </div>
      {showCreate && <CreateBatchModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); show('批次已创建并自动分配到已缴费学生订单'); load(); }} />}
    </div>
  );
}

function CreateBatchModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [planDetail, setPlanDetail] = useState<any>(null);
  const [f, setF] = useState<any>({ plan_id: '', name: '', expected_arrival: '', lines: [] });
  const [blockers, setBlockers] = useState<any[]>([]);
  const { show, node } = useToast();

  useEffect(() => {
    api('/api/plans').then((d) => setPlans(d.plans));
    api('/api/dashboard/production-blockers').then((d) => setBlockers(d.blocked)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!f.plan_id) return;
    api(`/api/plans/${f.plan_id}`).then((d) => {
      setPlanDetail(d);
      setF((prev: any) => ({
        ...prev,
        name: `${d.plan.name}-批次`,
        lines: d.items.map((it: any) => ({ plan_item_id: it.id, size: '', qty: 0 })),
      }));
    });
  }, [f.plan_id]);

  async function submit() {
    const lines = f.lines.filter((l: any) => l.size && Number(l.qty) > 0);
    try {
      await api('/api/batches', { method: 'POST', body: JSON.stringify({ plan_id: Number(f.plan_id), name: f.name, expected_arrival: f.expected_arrival, lines }) });
      onDone();
    } catch (e: any) { show(e.message, true); }
  }

  return (
    <Modal title="创建生产批次（按品类+尺码汇总数量）" onClose={onClose} wide>
      {node}
      <div className="grid grid-2">
        <div className="field"><label>订购计划</label>
          <select value={f.plan_id} onChange={(e) => setF({ ...f, plan_id: Number(e.target.value) })}>
            <option value="">请选择</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>批次名称</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>预计到校日期</label><input type="date" value={f.expected_arrival} onChange={(e) => setF({ ...f, expected_arrival: e.target.value })} /></div>
      </div>
      {planDetail && (
        <>
          <table>
            <thead><tr><th>品类</th><th>部位</th><th>尺码</th><th>投产数量</th></tr></thead>
            <tbody>
              {f.lines.map((ln: any, i: number) => {
                const it = planDetail.items.find((x: any) => x.id === ln.plan_item_id);
                return (
                  <tr key={ln.plan_item_id}>
                    <td>{it?.name}</td><td>{it?.garment_type}</td>
                    <td><input style={{ width: 100 }} placeholder="如 140 / 34" value={ln.size}
                      onChange={(e) => setF({ ...f, lines: f.lines.map((x: any, j: number) => j === i ? { ...x, size: e.target.value } : x) })} /></td>
                    <td><input style={{ width: 90 }} type="number" min={0} value={ln.qty || ''}
                      onChange={(e) => setF({ ...f, lines: f.lines.map((x: any, j: number) => j === i ? { ...x, qty: Number(e.target.value) } : x) })} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {blockers.some((b) => b.plan_name === planDetail.plan.name) && (
            <p className="muted" style={{ color: 'var(--red)' }}>
              ⚠ 本计划仍有 {blockers.filter((b) => b.plan_name === planDetail.plan.name).length} 个订单不可投产，若数量不足会提示差额。
            </p>
          )}
        </>
      )}
      <div style={{ textAlign: 'right', marginTop: 12 }}><button className="btn" onClick={submit}>创建并自动分配</button></div>
    </Modal>
  );
}
