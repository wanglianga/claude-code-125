'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/fetch';
import { Badge, Modal, useToast } from '@/components/ui';

export default function StudentsPage() {
  const [me, setMe] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [subsidyFor, setSubsidyFor] = useState<any>(null);
  const [subsidies, setSubsidies] = useState<any[]>([]);
  const { show, node } = useToast();

  const isGA = me && ['general_affairs', 'admin'].includes(me.role);
  const load = () => api('/api/students').then((d) => setStudents(d.students));
  useEffect(() => {
    api('/api/auth/me').then((d) => setMe(d.user));
    load();
    api('/api/subsidies').then((d) => setSubsidies(d.subsidies)).catch(() => {});
  }, []);

  const list = students.filter((s) => !q || s.name.includes(q) || s.student_no.includes(q));

  return (
    <div>
      {node}
      <div className="spread">
        <h2>学生与尺码档案</h2>
        <div className="row">
          <input placeholder="搜索姓名/学号" value={q} onChange={(e) => setQ(e.target.value)} />
          {isGA && <button className="btn" onClick={() => setEditing({})}>＋ 新增学生</button>}
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr>
            <th>学号</th><th>姓名</th><th>校区/班级</th><th>状态</th><th>身高</th><th>体重</th><th>常穿尺码</th>
            <th>特殊版型</th><th>贫困减免</th><th>操作</th>
          </tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.student_no}</td>
                <td>{s.name}</td>
                <td>{s.campus_name} {s.class_name}</td>
                <td><Badge status={s.status} />{s.transferred_at && <div className="muted" style={{ fontSize: 11 }}>{s.transferred_at}</div>}</td>
                <td>{s.height_cm || '-'}</td><td>{s.weight_kg || '-'}</td><td>{s.usual_size || '-'}</td>
                <td>{s.special_fit ? <span style={{ color: 'var(--amber)' }}>{s.special_fit_note}</span> : <span className="muted">否</span>}</td>
                <td>{s.subsidy ? <Badge status={s.subsidy.split(':')[1]} /> : <span className="muted">—</span>}</td>
                <td className="row" style={{ gap: 4 }}>
                  <button className="btn gray sm" onClick={() => setEditing(s)}>
                    {me?.role === 'parent' ? '更新尺码' : '编辑'}
                  </button>
                  {(me?.role === 'parent' || isGA) && !s.subsidy && s.status === 'active' &&
                    <button className="btn secondary sm" onClick={() => setSubsidyFor(s)}>申请减免</button>}
                  {isGA && s.status === 'active' &&
                    <button className="btn danger sm" onClick={async () => {
                      if (!confirm(`确认将 ${s.name} 标记为转学？进行中订单将挂起，已缴费订单自动生成退款工单。`)) return;
                      try {
                        await api('/api/students/transfer', { method: 'POST', body: JSON.stringify({ student_id: s.id }) });
                        show('已标记转学并处理订单'); load();
                      } catch (e: any) { show(e.message, true); }
                    }}>转学</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <StudentModal student={editing} isGA={isGA} onClose={() => setEditing(null)}
          onDone={async () => { setEditing(null); show('已保存'); load(); }} />
      )}
      {subsidyFor && (
        <SubsidyModal student={subsidyFor} onClose={() => setSubsidyFor(null)}
          onDone={async () => { setSubsidyFor(null); show('减免申请已提交，等待总务审批'); load(); api('/api/subsidies').then((d) => setSubsidies(d.subsidies)); }} />
      )}

      {isGA && subsidies.length > 0 && (
        <div className="card">
          <h2>贫困生减免审批</h2>
          <table>
            <thead><tr><th>学生</th><th>班级</th><th>减免比例</th><th>原因</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {subsidies.map((sb) => (
                <tr key={sb.id}>
                  <td>{sb.student_name}（{sb.student_no}）</td><td>{sb.class_name}</td>
                  <td><b>{Math.round(sb.ratio * 100)}%</b></td><td>{sb.reason}</td>
                  <td><Badge status={sb.status} /></td>
                  <td>{sb.status === 'pending' && (
                    <span className="row" style={{ gap: 4 }}>
                      <button className="btn sm" onClick={async () => {
                        await api('/api/subsidies', { method: 'PATCH', body: JSON.stringify({ id: sb.id, status: 'approved' }) });
                        show('已批准'); load(); api('/api/subsidies').then((d) => setSubsidies(d.subsidies));
                      }}>批准</button>
                      <button className="btn danger sm" onClick={async () => {
                        await api('/api/subsidies', { method: 'PATCH', body: JSON.stringify({ id: sb.id, status: 'rejected' }) });
                        show('已驳回'); api('/api/subsidies').then((d) => setSubsidies(d.subsidies));
                      }}>驳回</button>
                    </span>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentModal({ student, isGA, onClose, onDone }: { student: any; isGA: boolean; onClose: () => void; onDone: () => void }) {
  const [campuses, setCampuses] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [f, setF] = useState<any>({
    id: student.id, student_no: student.student_no || '', name: student.name || '',
    campus_id: student.campus_id || '', grade_id: student.grade_id || '', class_id: student.class_id || '',
    height_cm: student.height_cm ?? '', weight_kg: student.weight_kg ?? '',
    usual_size: student.usual_size || '', special_fit: !!student.special_fit,
    special_fit_note: student.special_fit_note || '',
  });
  const { show, node } = useToast();

  useEffect(() => {
    api('/api/campuses').then((d) => setCampuses(d.campuses));
    api('/api/grades').then((d) => setGrades(d.grades));
    api('/api/classes').then((d) => setClasses(d.classes));
  }, []);

  async function save() {
    try {
      const body: any = { ...f, height_cm: f.height_cm ? Number(f.height_cm) : null, weight_kg: f.weight_kg ? Number(f.weight_kg) : null };
      if (f.id) {
        // 家长端：PATCH 尺码信息；总务：POST 全量
        if (isGA) await api('/api/students', { method: 'POST', body: JSON.stringify(body) });
        else await api('/api/students', { method: 'PATCH', body: JSON.stringify({ student_id: f.id, height_cm: body.height_cm, weight_kg: body.weight_kg, usual_size: body.usual_size, special_fit: body.special_fit, special_fit_note: body.special_fit_note }) });
      } else {
        await api('/api/students', { method: 'POST', body: JSON.stringify(body) });
      }
      onDone();
    } catch (e: any) { show(e.message, true); }
  }

  const gradesInCampus = grades.filter((g) => !f.campus_id || g.campus_id === f.campus_id);
  const classesInGrade = classes.filter((c) => !f.grade_id || c.grade_id === f.grade_id);

  return (
    <Modal title={f.id ? `编辑学生 · ${f.name || ''}` : '新增学生'} onClose={onClose}>
      {node}
      {isGA && (
        <div className="grid grid-2">
          <div className="field"><label>学号</label><input value={f.student_no} onChange={(e) => setF({ ...f, student_no: e.target.value })} /></div>
          <div className="field"><label>姓名</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="field"><label>校区</label>
            <select value={f.campus_id} onChange={(e) => setF({ ...f, campus_id: Number(e.target.value), grade_id: '', class_id: '' })}>
              <option value="">请选择</option>{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field"><label>年级</label>
            <select value={f.grade_id} onChange={(e) => setF({ ...f, grade_id: Number(e.target.value), class_id: '' })}>
              <option value="">请选择</option>{gradesInCampus.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="field"><label>班级</label>
            <select value={f.class_id} onChange={(e) => setF({ ...f, class_id: Number(e.target.value) })}>
              <option value="">请选择</option>{classesInGrade.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="grid grid-3">
        <div className="field"><label>身高(cm)</label><input type="number" value={f.height_cm} onChange={(e) => setF({ ...f, height_cm: e.target.value })} /></div>
        <div className="field"><label>体重(kg)</label><input type="number" value={f.weight_kg} onChange={(e) => setF({ ...f, weight_kg: e.target.value })} /></div>
        <div className="field"><label>常穿尺码</label><input placeholder="如 140 / 170" value={f.usual_size} onChange={(e) => setF({ ...f, usual_size: e.target.value })} /></div>
      </div>
      <div className="field">
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--ink)' }}>
          <input type="checkbox" checked={f.special_fit} onChange={(e) => setF({ ...f, special_fit: e.target.checked })} />
          需要特殊版型（偏胖/偏瘦/加肥等）
        </label>
      </div>
      <div className="field"><label>特殊版型说明</label>
        <input value={f.special_fit_note} onChange={(e) => setF({ ...f, special_fit_note: e.target.value })} /></div>
      <div style={{ textAlign: 'right' }}><button className="btn" onClick={save}>保存</button></div>
    </Modal>
  );
}

function SubsidyModal({ student, onClose, onDone }: { student: any; onClose: () => void; onDone: () => void }) {
  const [ratio, setRatio] = useState(0.5);
  const [reason, setReason] = useState('家庭经济困难，申请贫困生减免');
  const { show, node } = useToast();
  async function submit() {
    try {
      await api('/api/subsidies', { method: 'POST', body: JSON.stringify({ student_id: student.id, ratio: Number(ratio), reason }) });
      onDone();
    } catch (e: any) { show(e.message, true); }
  }
  return (
    <Modal title={`申请贫困生减免 · ${student.name}`} onClose={onClose}>
      {node}
      <div className="field"><label>减免比例</label>
        <select value={ratio} onChange={(e) => setRatio(Number(e.target.value))}>
          {[0.2, 0.3, 0.5, 0.8, 1].map((r) => <option key={r} value={r}>{Math.round(r * 100)}%</option>)}
        </select>
      </div>
      <div className="field"><label>情况说明</label><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      <div style={{ textAlign: 'right' }}><button className="btn" onClick={submit}>提交申请</button></div>
    </Modal>
  );
}
