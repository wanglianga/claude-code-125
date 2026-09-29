'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/fetch';
import { Badge, SUIT_LABELS, GARMENT_LABELS } from '@/components/ui';

export default function PlanDetailPage() {
  const { id } = useParams();
  const [d, setD] = useState<any>(null);
  useEffect(() => { api(`/api/plans/${id}`).then(setD); }, [id]);
  if (!d) return <div className="empty">加载中…</div>;
  const { plan, items, campuses, grades, sessions, order_stats } = d;

  return (
    <div>
      <div className="spread">
        <h2>{plan.name}</h2>
        <div className="row">
          <Badge status={plan.kind} /><Badge status={plan.status} />
          <Link className="btn gray sm" href="/plans">返回列表</Link>
        </div>
      </div>
      <p className="muted">
        {plan.academic_year} · {plan.season} · 供应商：{plan.supplier_name} ·
        订购截止 {plan.order_deadline} · 试穿日 {plan.fitting_date || '待定'}
      </p>

      <div className="grid grid-4">
        <div className="stat"><div className="num">{campuses.map((c: any) => c.name).join('、')}</div><div className="lbl">统一采购覆盖校区</div></div>
        <div className="stat"><div className="num">{grades.length}</div><div className="lbl">覆盖年级</div></div>
        <div className="stat"><div className="num">{items.length}</div><div className="lbl">计划品类</div></div>
        <div className="stat"><div className="num">{order_stats.reduce((a: number, x: any) => a + Number(x.cnt), 0)}</div><div className="lbl">订单总数</div></div>
      </div>

      <div className="card">
        <h2>订单状态分布</h2>
        <div className="pill-row">
          {order_stats.length ? order_stats.map((s: any) => (
            <span key={s.status} style={{ marginRight: 10 }}><Badge status={s.status} /> × {s.cnt}</span>
          )) : <span className="muted">暂无订单</span>}
        </div>
      </div>

      <div className="card">
        <h2>品类清单</h2>
        <table>
          <thead><tr><th>品类</th><th>套装类别</th><th>部位</th><th>单价</th><th>是否必购</th></tr></thead>
          <tbody>
            {items.map((it: any) => (
              <tr key={it.id}>
                <td>{it.name}</td><td>{SUIT_LABELS[it.suit_kind]}</td><td>{GARMENT_LABELS[it.garment_type]}</td>
                <td>¥{it.price}</td><td>{it.required ? '必购' : <span className="muted">增购件</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>试穿时段（班主任组织）</h2>
        <table>
          <thead><tr><th>开始</th><th>结束</th><th>班级</th><th>地点</th><th>组织人</th><th>已登记/人数</th></tr></thead>
          <tbody>
            {sessions.map((s: any) => (
              <tr key={s.id}>
                <td>{s.start_time}</td><td>{s.end_time}</td><td>{s.class_name}</td><td>{s.location}</td>
                <td>{s.organizer_name || '—'}</td>
                <td><Link href={`/fitting/${s.id}`}>{s.recorded}/{s.student_count} 人记录 ›</Link></td>
              </tr>
            ))}
            {!sessions.length && <tr><td colSpan={6} className="empty">班主任尚未安排时段</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
