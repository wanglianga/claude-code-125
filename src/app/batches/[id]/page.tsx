'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/fetch';
import { Badge, Modal, useToast } from '@/components/ui';

export default function BatchDetailPage() {
  const { id } = useParams();
  const [me, setMe] = useState<any>(null);
  const [d, setD] = useState<any>(null);
  const [shipFor, setShipFor] = useState(false);
  const { show, node } = useToast();
  const load = () => api(`/api/batches/${id}`).then(setD);
  useEffect(() => { api('/api/auth/me').then((r) => setMe(r.user)); load(); }, [id]);
  if (!d) return <div className="empty">加载中…</div>;
  const b = d.batch;
  const isVendor = me && ['supplier', 'factory', 'admin'].includes(me.role);

  async function act(action: string, extra: any = {}) {
    await api(`/api/batches/${id}`, { method: 'POST', body: JSON.stringify({ id: b.id, action, ...extra }) });
    show('操作成功'); load();
  }

  return (
    <div>
      {node}
      <div className="spread">
        <h2>批次 <span className="mono" style={{ fontSize: 14 }}>{b.batch_no}</span></h2>
        <div className="row"><Badge status={b.status} /><Link className="btn gray sm" href="/batches">返回</Link></div>
      </div>
      <p className="muted">{b.plan_name} · {b.name} · 预计到校 {b.expected_arrival || '未设定'}</p>

      {isVendor && (
        <div className="card row">
          {b.status === 'planned' && <button className="btn" onClick={() => act('start')}>▶ 批次开工</button>}
          {b.status === 'in_production' && <button className="btn" onClick={() => {
            // 一键按计划数全部报产（演示用）
            act('produce', { lines: d.lines.map((l: any) => ({ batch_item_id: l.id, produced_qty: l.qty })) });
          }}>✔ 报产完成（全部明细）</button>}
          {b.status === 'produced' && <button className="btn" onClick={() => setShipFor(true)}>🚚 分批发货</button>}
          {['part_shipped', 'produced'].includes(b.status)
            ? <button className="btn secondary" onClick={() => act('complete')}>标记批次完成</button>
            : null}
          <div className="field" style={{ margin: 0 }}>
            <label>更新预计到校时间</label>
            <input type="date" defaultValue={b.expected_arrival || ''}
              onChange={(e) => { if (e.target.value) act('arrival_date', { expected_arrival: e.target.value }); }} />
          </div>
        </div>
      )}

      <div className="card">
        <h2>批次明细与学生分配（同批校服可追踪到人）</h2>
        <table>
          <thead><tr><th>品类</th><th>尺码</th><th>计划数</th><th>已生产</th><th>分配学生数</th><th>分配明细</th></tr></thead>
          <tbody>
            {d.lines.map((l: any) => (
              <tr key={l.id}>
                <td>{l.item_name}</td><td><b>{l.size}</b></td>
                <td>{l.qty}</td><td>{l.produced_qty}</td><td>{l.alloc_students}</td>
                <td className="mono" style={{ fontSize: 11 }}>{l.alloc_detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>本批次发货记录（供应商可分批发货）</h2>
        <table>
          <thead><tr><th>发货单号</th><th>承运/单号</th><th>发货时间</th><th>预计到校</th><th>状态</th><th>数量(发/到)</th><th></th></tr></thead>
          <tbody>
            {d.shipments.map((s: any) => (
              <tr key={s.id}>
                <td className="mono">{s.shipment_no}</td><td>{s.carrier} {s.tracking_no}</td>
                <td>{s.shipped_at}</td><td>{s.expected_arrival}</td><td><Badge status={s.status} /></td>
                <td>{s.line_qty}/{s.arrived_qty}</td>
                <td><Link className="btn gray sm" href={`/shipments/${s.id}`}>到校确认/明细 ›</Link></td>
              </tr>
            ))}
            {!d.shipments.length && <tr><td colSpan={7} className="empty">尚未发货</td></tr>}
          </tbody>
        </table>
      </div>

      {shipFor && <ShipModal batch={b} onClose={() => setShipFor(false)} onDone={() => { setShipFor(false); show('已创建发货单'); load(); }} />}
    </div>
  );
}

function ShipModal({ batch, onClose, onDone }: { batch: any; onClose: () => void; onDone: () => void }) {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState({ carrier: '校校通物流', tracking_no: '', shipped_at: '2026-10-18 09:00:00', expected_arrival: batch.expected_arrival || '2026-10-20' });
  const [picked, setPicked] = useState<Record<number, number>>({});
  const { show, node } = useToast();

  useEffect(() => { api(`/api/batches/${batch.id}`).then((r) => {
    setD(r);
    // 默认全量发第一批（用户可修改数量）
    const m: any = {};
    for (const l of r.lines) {
      // 该明细尚未发货的可发数来自分配，需要逐 order_item；这里简化为进入页面后用 shipments 数据
      m[l.id] = l.qty - (l.produced_qty < l.qty ? 0 : 0);
    }
  }); }, []);

  // 候选明细：从批次分配的订单明细中取（需未发满）
  const [cands, setCands] = useState<any[]>([]);
  useEffect(() => {
    // 用批次页 lines.alloc_detail 无法拿到 order_item_id，改为请求：直接展示 shipments? 不适用。
    // 通过新增轻量接口拿候选
    api(`/api/batches/${batch.id}/candidates`).then((r) => {
      setCands(r.candidates);
      const m: any = {};
      for (const c of r.candidates) m[c.order_item_id] = c.avail;
      setPicked(m);
    }).catch(() => {});
  }, []);

  async function submit() {
    const lines = Object.entries(picked).map(([oid, qty]) => ({ order_item_id: Number(oid), qty: Number(qty) })).filter((x) => x.qty > 0);
    if (!lines.length) return show('请填写发货数量', true);
    try {
      await api('/api/shipments', { method: 'POST', body: JSON.stringify({ batch_id: batch.id, ...f, lines }) });
      onDone();
    } catch (e: any) { show(e.message, true); }
  }

  return (
    <Modal title={`分批发货 · ${batch.batch_no}`} onClose={onClose} wide>
      {node}
      <div className="grid grid-4">
        <div className="field"><label>承运商</label><input value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} /></div>
        <div className="field"><label>物流单号</label><input value={f.tracking_no} onChange={(e) => setF({ ...f, tracking_no: e.target.value })} /></div>
        <div className="field"><label>发货时间</label><input value={f.shipped_at} onChange={(e) => setF({ ...f, shipped_at: e.target.value })} /></div>
        <div className="field"><label>预计到校</label><input type="date" value={f.expected_arrival} onChange={(e) => setF({ ...f, expected_arrival: e.target.value })} /></div>
      </div>
      <table>
        <thead><tr><th>学生</th><th>班级</th><th>品类</th><th>尺码</th><th>本批可发</th><th>本次发货</th></tr></thead>
        <tbody>
          {cands.map((c) => (
            <tr key={c.order_item_id}>
              <td>{c.student_name}</td><td>{c.class_name}</td><td>{c.item_name}</td><td>{c.size}</td>
              <td>{c.avail}</td>
              <td><input style={{ width: 80 }} type="number" min={0} max={c.avail} value={picked[c.order_item_id] ?? 0}
                onChange={(e) => setPicked({ ...picked, [c.order_item_id]: Number(e.target.value) })} /></td>
            </tr>
          ))}
          {!cands.length && <tr><td colSpan={6} className="empty">没有可发货明细（未分配或已发满）</td></tr>}
        </tbody>
      </table>
      <p className="muted">可只发一部分，剩余数量在后续批次发货单中继续发（供应商分批发货）。</p>
      <div style={{ textAlign: 'right' }}><button className="btn" onClick={submit}>创建发货单</button></div>
    </Modal>
  );
}
