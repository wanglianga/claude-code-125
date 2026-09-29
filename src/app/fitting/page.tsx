'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/fetch';
import { Badge, Modal, useToast } from '@/components/ui';

export default function FittingPage() {
  const [me, setMe] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState<any>({ plan_id: '', class_id: '', start_time: '', end_time: '', location: '' });
  const { show, node } = useToast();

  const load = () => api('/api/fitting-sessions').then((d) => setSessions(d.sessions));
  useEffect(() => {
    api('/api/auth/me').then((d) => setMe(d.user));
    api('/api/plans').then((d) => setPlans(d.plans));
    api('/api/classes').then((d) => setClasses(d.classes)).catch(() => {});
    load();
  }, []);

  return (
    <div>
      {node}
      <div className="spread">
        <h2>试穿日组织</h2>
        {['head_teacher', 'general_affairs', 'admin'].includes(me?.role) &&
          <button className="btn" onClick={() => setShowCreate(true)}>＋ 安排试穿时段</button>}
      </div>
      <p className="muted">班主任按时段组织学生试穿，工作人员逐人登记上衣、裤子、裙装、外套、鞋码五类建议。</p>
      <div className="card">
        <table>
          <thead><tr><th>时段</th><th>订购计划</th><th>校区</th><th>班级</th><th>地点</th><th>组织人</th><th>登记进度</th><th></th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.start_time} ~ {s.end_time}</td>
                <td>{plans.find((p) => p.id === s.plan_id)?.name}</td>
                <td>{s.campus_name}</td><td>{s.class_name}</td><td>{s.location}</td><td>{s.organizer_name}</td>
                <td>{s.recorded}/{s.student_count}</td>
                <td><Link className="btn secondary sm" href={`/fitting/${s.id}`}>进入登记 ›</Link></td>
              </tr>
            ))}
            {!sessions.length && <tr><td colSpan={8} className="empty">暂无试穿时段</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="安排试穿时段" onClose={() => setShowCreate(false)}>
          <div className="field"><label>订购计划</label>
            <select value={f.plan_id} onChange={(e) => setF({ ...f, plan_id: Number(e.target.value) })}>
              <option value="">请选择</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field"><label>班级</label>
            <select value={f.class_id} onChange={(e) => setF({ ...f, class_id: Number(e.target.value) })}>
              <option value="">请选择</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-2">
            <div className="field"><label>开始时间</label><input placeholder="2026-10-08 09:00:00" value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></div>
            <div className="field"><label>结束时间</label><input placeholder="2026-10-08 10:00:00" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></div>
          </div>
          <div className="field"><label>地点</label><input placeholder="如：体育馆A区" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div style={{ textAlign: 'right' }}>
            <button className="btn" onClick={async () => {
              try {
                await api('/api/fitting-sessions', { method: 'POST', body: JSON.stringify(f) });
                setShowCreate(false); show('时段已安排'); load();
              } catch (e: any) { show(e.message, true); }
            }}>创建</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
