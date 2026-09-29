import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { one, q } from '../../../../lib/db';
import { L, fmtDT, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function TeacherAftersales({ searchParams }) {
  const user = await requireUser(['TEACHER']);
  const cls = await one('SELECT * FROM classes WHERE teacher_id=?', [user.id]);
  if (!cls) return <div className="card">您尚未绑定班级。</div>;
  const tickets = await q(
    `SELECT a.*, s.name AS student_name, s.student_no, o.order_no
     FROM aftersales a JOIN students s ON s.id=a.student_id JOIN orders o ON o.id=a.order_id
     WHERE s.class_id=? ORDER BY a.id DESC`, [cls.id]);

  return (
    <>
      <div className="page-title">售后跟进 <span className="muted small">{cls.name} · 本班学生的换码/补发/退款/投诉进度</span></div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>工单号</th><th>学生</th><th>订单</th><th>类型</th><th>内容</th><th>状态</th><th>处理结果</th><th>提交时间</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{t.ticket_no}</td>
                  <td>{t.student_name}</td>
                  <td><Link href={`/orders/${t.order_id}`}>{t.order_no}</Link></td>
                  <td>{label(L.asType, t.type)}</td>
                  <td className="small">{t.item_desc || '—'}{t.from_size ? ` ${t.from_size}→${t.to_size || '?'}` : ''}</td>
                  <td><Badge text={label(L.asStatus, t.status)} /></td>
                  <td className="small">{t.resolution || '—'}</td>
                  <td className="small nowrap">{fmtDT(t.created_at)}</td>
                </tr>
              ))}
              {tickets.length === 0 && <tr><td colSpan={8} className="muted">本班暂无售后工单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
