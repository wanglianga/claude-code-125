import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { handleTicket, addTicketNote } from '../../../../../lib/actions/service';
import { L, fmtDT, fmtMoney, label } from '../../../../../lib/util';
import { Badge, Msg } from '../../../../../components/ui';

export default async function TicketDetail({ params, searchParams }) {
  const user = await requireUser(['SERVICE', 'ADMIN']);
  const t = await one(
    `SELECT a.*, s.name AS student_name, s.student_no, c.name AS class_name, o.order_no, o.final_amount,
       u.name AS creator_name, h.name AS handler_name
     FROM aftersales a
     JOIN students s ON s.id=a.student_id
     JOIN classes c ON c.id=s.class_id
     JOIN orders o ON o.id=a.order_id
     LEFT JOIN users u ON u.id=a.created_by
     LEFT JOIN users h ON h.id=a.handler_id
     WHERE a.id=?`, [params.id]);
  if (!t) redirect('/service');
  const events = await q('SELECT * FROM events WHERE entity=? AND entity_id=? ORDER BY id DESC', ['AFTERSALE', t.id]);
  const orderItem = t.order_item_id ? await one('SELECT * FROM order_items WHERE id=?', [t.order_item_id]) : null;
  const back = `/service/tickets/${t.id}`;
  const open = !['RESOLVED', 'CLOSED', 'REJECTED'].includes(t.status);

  return (
    <>
      <div className="between">
        <div className="page-title">工单 {t.ticket_no} <Badge text={label(L.asStatus, t.status)} /></div>
        <Link href={user.role === 'ADMIN' ? '/admin/aftersales' : '/service'} className="btn ghost sm">返回列表</Link>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <h3>工单信息</h3>
        <div className="grid cols-3 small">
          <div><span className="muted">学生：</span>{t.student_name}（{t.student_no} · {t.class_name}）</div>
          <div><span className="muted">订单：</span><Link href={`/orders/${t.order_id}`}>{t.order_no}</Link>（实缴 {fmtMoney(t.final_amount)}）</div>
          <div><span className="muted">类型：</span>{label(L.asType, t.type)}</div>
          <div><span className="muted">涉及项目：</span>{t.item_desc || '—'}{orderItem ? `（当前尺码 ${orderItem.size}）` : ''}</div>
          <div><span className="muted">尺码：</span>{t.from_size ? `${t.from_size} → ${t.to_size || '?'}` : '—'}</div>
          <div><span className="muted">提交人：</span>{t.creator_name || '—'} · {fmtDT(t.created_at)}</div>
          <div style={{ gridColumn: '1 / -1' }}><span className="muted">原因：</span>{t.reason}</div>
          {t.resolution && <div style={{ gridColumn: '1 / -1' }}><span className="muted">处理结果：</span>{t.resolution}{t.refund_amount ? `（退款 ${fmtMoney(t.refund_amount)}）` : ''}</div>}
        </div>
      </div>

      {open && (
        <div className="card">
          <h3>处理工单</h3>
          {t.status === 'SUBMITTED' && (
            <form action={handleTicket} className="mb">
              <input type="hidden" name="ticket_id" value={t.id} />
              <input type="hidden" name="action" value="accept" />
              <button className="btn sm">受理工单</button>
            </form>
          )}
          <form action={handleTicket}>
            <input type="hidden" name="ticket_id" value={t.id} />
            <div className="form-grid">
              {t.type === 'EXCHANGE' && (
                <div className="field"><label>换码后尺码</label><input name="new_size" placeholder={t.to_size || '如 140'} /></div>
              )}
              {['REFUND', 'ALLERGY', 'COMPLAINT'].includes(t.type) && (
                <div className="field"><label>退款金额（元，可空）</label><input name="refund_amount" type="number" step="0.01" min="0" placeholder="0.00" /></div>
              )}
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>处理结果说明</label>
                <textarea name="resolution" placeholder="如：已安排换码，新尺码随下一批发货 / 已退款 / 工厂已补发" />
              </div>
            </div>
            <div className="btn-row mt">
              <button className="btn sm" name="action" value="resolve">办结工单</button>
              <button className="btn sm danger" name="action" value="reject">驳回</button>
            </div>
          </form>
          <form action={addTicketNote} className="flex mt">
            <input type="hidden" name="ticket_id" value={t.id} />
            <input name="note" placeholder="给家长留言（如：请补充过敏照片）" style={{ flex: 1, padding: '6px 9px' }} />
            <button className="btn sm ghost">发送留言</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>处理记录</h3>
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.id}>
              <div className="t">{fmtDT(e.created_at)} · {e.actor_name} · {e.action}</div>
              <div className="d">{e.detail}</div>
            </li>
          ))}
          {!events.length && <li className="muted">暂无记录</li>}
        </ul>
      </div>
    </>
  );
}
