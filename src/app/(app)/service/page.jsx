import Link from 'next/link';
import { requireUser } from '../../../lib/session';
import { q } from '../../../lib/db';
import { L, fmtDT, label } from '../../../lib/util';
import { Badge, Msg, Stat } from '../../../components/ui';

export default async function ServiceHome({ searchParams }) {
  await requireUser(['SERVICE']);
  const filter = searchParams.status || '';
  const tickets = await q(
    `SELECT a.*, s.name AS student_name, c.name AS class_name, o.order_no
     FROM aftersales a
     JOIN students s ON s.id=a.student_id
     JOIN classes c ON c.id=s.class_id
     JOIN orders o ON o.id=a.order_id
     ${filter ? 'WHERE a.status=?' : ''}
     ORDER BY (a.status IN ('RESOLVED','CLOSED','REJECTED')), a.id DESC`,
    filter ? [filter] : []);
  const open = tickets.filter((t) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(t.status));

  return (
    <>
      <div className="page-title">售后工作台</div>
      <Msg searchParams={searchParams} />
      <div className="grid cols-4 mb">
        <Stat num={open.length} label="待处理工单" tone="warn" />
        <Stat num={tickets.filter((t) => t.type === 'EXCHANGE' && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(t.status)).length} label="换码申请" />
        <Stat num={tickets.filter((t) => ['ALLERGY', 'COMPLAINT'].includes(t.type)).length} label="过敏/投诉" />
        <Stat num={tickets.length} label="全部工单" />
      </div>
      <div className="flex mb">
        <Link className={`btn sm ${!filter ? '' : 'ghost'}`} href="/service">全部</Link>
        {Object.entries(L.asStatus).map(([k, v]) => (
          <Link key={k} className={`btn sm ${filter === k ? '' : 'ghost'}`} href={`/service?status=${k}`}>{v}</Link>
        ))}
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>工单号</th><th>学生</th><th>班级</th><th>订单</th><th>类型</th><th>内容</th><th>状态</th><th>提交时间</th><th></th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{t.ticket_no}</td>
                  <td>{t.student_name}</td>
                  <td className="small">{t.class_name}</td>
                  <td><Link href={`/orders/${t.order_id}`}>{t.order_no}</Link></td>
                  <td>{label(L.asType, t.type)}</td>
                  <td className="small">{t.item_desc || '—'}{t.from_size ? ` ${t.from_size}→${t.to_size || '?'}` : ''}</td>
                  <td><Badge text={label(L.asStatus, t.status)} /></td>
                  <td className="small nowrap">{fmtDT(t.created_at)}</td>
                  <td><Link className="btn sm" href={`/service/tickets/${t.id}`}>处理</Link></td>
                </tr>
              ))}
              {tickets.length === 0 && <tr><td colSpan={9} className="muted">暂无工单</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
