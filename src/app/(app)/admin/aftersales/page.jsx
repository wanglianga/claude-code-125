import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { q } from '../../../../lib/db';
import { L, fmtDT, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function AdminAftersales({ searchParams }) {
  await requireUser(['ADMIN']);
  const filter = searchParams.status || '';
  const tickets = await q(
    `SELECT a.*, s.name AS student_name, c.name AS class_name, o.order_no, u.name AS handler_name
     FROM aftersales a
     JOIN students s ON s.id=a.student_id
     JOIN classes c ON c.id=s.class_id
     JOIN orders o ON o.id=a.order_id
     LEFT JOIN users u ON u.id=a.handler_id
     ${filter ? 'WHERE a.status=?' : ''}
     ORDER BY (a.status IN ('RESOLVED','CLOSED','REJECTED')), a.id DESC`,
    filter ? [filter] : []);

  return (
    <>
      <div className="page-title">售后工单</div>
      <Msg searchParams={searchParams} />
      <div className="flex mb">
        <Link className={`btn sm ${!filter ? '' : 'ghost'}`} href="/admin/aftersales">全部</Link>
        {Object.entries(L.asStatus).map(([k, v]) => (
          <Link key={k} className={`btn sm ${filter === k ? '' : 'ghost'}`} href={`/admin/aftersales?status=${k}`}>{v}</Link>
        ))}
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>工单号</th><th>学生</th><th>班级</th><th>订单</th><th>类型</th><th>内容</th><th>状态</th><th>客服</th><th>提交时间</th><th></th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{t.ticket_no}</td>
                  <td>{t.student_name}</td>
                  <td className="small">{t.class_name}</td>
                  <td><Link href={`/orders/${t.order_id}`}>{t.order_no}</Link></td>
                  <td>{label(L.asType, t.type)}</td>
                  <td className="small">{t.item_desc || '—'}</td>
                  <td><Badge text={label(L.asStatus, t.status)} /></td>
                  <td className="small">{t.handler_name || '—'}</td>
                  <td className="small nowrap">{fmtDT(t.created_at)}</td>
                  <td><Link className="btn sm" href={`/service/tickets/${t.id}`}>处理</Link></td>
                </tr>
              ))}
              {tickets.length === 0 && <tr><td colSpan={10} className="muted">暂无工单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
