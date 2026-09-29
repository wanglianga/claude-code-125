'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/fetch';
import { useToast } from '@/components/ui';

const COLS = [['size_top', '上衣'], ['size_pants', '裤子'], ['size_skirt', '裙装'], ['size_coat', '外套'], ['size_shoes', '鞋码']] as const;
const SIZES = ['', '110', '120', '130', '140', '150', '160', '170', '175', '180'];
const SHOES = ['', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40'];

export default function FittingSessionPage() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  const [rows, setRows] = useState<Record<number, any>>({});
  const { show, node } = useToast();

  const load = () => api(`/api/fitting-sessions/${id}`).then((res) => {
    setD(res);
    const m: any = {};
    for (const s of res.students) {
      m[s.id] = {
        size_top: s.size_top || '', size_pants: s.size_pants || '', size_skirt: s.size_skirt || '',
        size_coat: s.size_coat || '', size_shoes: s.size_shoes || '',
        special_note: s.special_note || '', staff_name: s.staff_name || '',
      };
    }
    setRows(m);
  });
  useEffect(() => { load(); }, [id]);

  if (!d) return <div className="empty">加载中…</div>;

  async function save(studentId: number) {
    const r = rows[studentId];
    try {
      await api(`/api/fitting-sessions/${id}`, { method: 'POST', body: JSON.stringify({ session_id: Number(id), student_id: studentId, ...r }) });
      show('试穿记录已保存'); load();
    } catch (e: any) { show(e.message, true); }
  }

  return (
    <div>
      {node}
      <div className="spread">
        <h2>试穿登记 · {d.session.class_name}</h2>
        <Link className="btn gray sm" href="/fitting">返回</Link>
      </div>
      <p className="muted">{d.session.start_time} ~ {d.session.end_time} · {d.session.location}</p>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr>
            <th>学号</th><th>姓名</th><th>身高/体重</th><th>常穿码</th>
            {COLS.map(([, l]) => <th key={l}>{l}建议</th>)}
            <th>特殊记录</th><th>登记人</th><th></th>
          </tr></thead>
          <tbody>
            {d.students.map((s: any) => {
              const r = rows[s.id] || {};
              return (
                <tr key={s.id} style={s.record_id ? { background: '#f6fff8' } : undefined}>
                  <td className="mono">{s.student_no}</td><td>{s.name}</td>
                  <td>{s.height_cm}/{s.weight_kg}</td><td>{s.usual_size}</td>
                  {COLS.map(([k]) => (
                    <td key={k}>
                      <select style={{ width: 72 }} value={r[k] || ''}
                        onChange={(e) => setRows({ ...rows, [s.id]: { ...r, [k]: e.target.value } })}>
                        {(k === 'size_shoes' ? SHOES : SIZES).map((z) => <option key={z} value={z}>{z || '—'}</option>)}
                      </select>
                    </td>
                  ))}
                  <td><input style={{ width: 130 }} placeholder="备注" value={r.special_note || ''}
                    onChange={(e) => setRows({ ...rows, [s.id]: { ...r, special_note: e.target.value } })} /></td>
                  <td><input style={{ width: 90 }} value={r.staff_name || ''} placeholder="工作人员"
                    onChange={(e) => setRows({ ...rows, [s.id]: { ...r, staff_name: e.target.value } })} /></td>
                  <td>
                    <button className="btn sm" onClick={() => save(s.id)}>{s.record_id ? '更新' : '保存'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
