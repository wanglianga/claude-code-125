'use server';

import { revalidatePath } from 'next/cache';
import { one, q, tx } from '../db';
import { getSession } from '../session';
import { logEvent, notify } from '../queries';
import { ok, fail, str, num } from './_shared';

async function requireService() {
  const s = await getSession();
  if (!s || (s.role !== 'SERVICE' && s.role !== 'ADMIN')) fail('/login', '请以售后客服身份登录');
  return s;
}

// 客服处理工单：受理 / 办结（含换码生成换码任务、退款登记、补发登记）
export async function handleTicket(formData) {
  const s = await requireService();
  const ticketId = num(formData.get('ticket_id'));
  const back = `/service/tickets/${ticketId}`;
  const ticket = await one('SELECT * FROM aftersales WHERE id=?', [ticketId]);
  if (!ticket) fail('/service', '工单不存在');
  const action = str(formData.get('action'), 20); // accept / resolve
  const resolution = str(formData.get('resolution'), 500);

  if (action === 'accept') {
    await tx(async (conn) => {
      await conn.query('UPDATE aftersales SET status=\'PROCESSING\', handler_id=? WHERE id=?', [s.uid, ticketId]);
      await logEvent('AFTERSALE', ticketId, 'ACCEPTED', { id: s.uid, name: s.name }, `工单 ${ticket.ticket_no} 已受理`, conn);
    });
    revalidatePath('/');
    ok(back, '工单已受理');
  }

  if (action === 'reject') {
    if (!resolution) fail(back, '请填写驳回原因');
    await tx(async (conn) => {
      await conn.query('UPDATE aftersales SET status=\'REJECTED\', handler_id=?, resolution=? WHERE id=?',
        [s.uid, resolution, ticketId]);
      await logEvent('AFTERSALE', ticketId, 'REJECTED', { id: s.uid, name: s.name }, `驳回：${resolution}`, conn);
      await notifyParent(ticket, `工单 ${ticket.ticket_no} 已驳回：${resolution}`, conn);
    });
    revalidatePath('/');
    ok(back, '工单已驳回');
  }

  if (action === 'resolve') {
    if (!resolution) fail(back, '请填写处理结果');
    const refundAmount = num(formData.get('refund_amount'));
    const newSize = str(formData.get('new_size'), 20);
    await tx(async (conn) => {
      // 退款类：登记退款流水并更新订单缴费状态
      if ((ticket.type === 'REFUND' || ticket.type === 'ALLERGY' || ticket.type === 'COMPLAINT') && refundAmount > 0) {
        await conn.query('INSERT INTO payments (order_id, amount, type, method, operator_id, remark) VALUES (?,?,?,?,?,?)',
          [ticket.order_id, refundAmount, 'REFUND', 'ONLINE', s.uid, `售后工单 ${ticket.ticket_no} 退款`]);
        const [oRows] = await conn.query('SELECT final_amount FROM orders WHERE id=?', [ticket.order_id]);
        const [rRows] = await conn.query(
          'SELECT COALESCE(SUM(amount),0) AS r FROM payments WHERE order_id=? AND type=\'REFUND\'', [ticket.order_id]);
        const newStatus = Number(rRows[0].r) >= Number(oRows[0].final_amount) ? 'REFUNDED' : 'PARTIAL_REFUND';
        await conn.query('UPDATE orders SET pay_status=? WHERE id=?', [newStatus, ticket.order_id]);
        await logEvent('ORDER', ticket.order_id, 'PAYMENT_REFUND', { id: s.uid, name: s.name },
          `售后退款 ¥${refundAmount.toFixed(2)}（工单 ${ticket.ticket_no}）`, conn);
      }
      // 换码类：更新订单明细尺码并留痕（新尺码随下一批发货/补发）
      if (ticket.type === 'EXCHANGE' && ticket.order_item_id && newSize) {
        await conn.query('UPDATE order_items SET size=? WHERE id=?', [newSize, ticket.order_item_id]);
        await logEvent('ORDER', ticket.order_id, 'SIZE_EXCHANGED', { id: s.uid, name: s.name },
          `换码完成：${ticket.item_desc || '校服'} ${ticket.from_size || '?'} → ${newSize}`, conn);
      }
      if (ticket.type === 'MISSING' || ticket.type === 'REISSUE') {
        await logEvent('ORDER', ticket.order_id, 'REISSUE_ARRANGED', { id: s.uid, name: s.name },
          `补发安排：${ticket.item_desc || '校服'}（工单 ${ticket.ticket_no}）`, conn);
      }
      await conn.query(
        'UPDATE aftersales SET status=\'RESOLVED\', handler_id=?, resolution=?, refund_amount=? WHERE id=?',
        [s.uid, resolution, refundAmount || null, ticketId]);
      await logEvent('AFTERSALE', ticketId, 'RESOLVED', { id: s.uid, name: s.name }, `办结：${resolution}`, conn);
      await notifyParent(ticket, `工单 ${ticket.ticket_no} 已办结：${resolution}`, conn);
    });
    revalidatePath('/');
    ok(back, '工单已办结');
  }

  fail(back, '非法操作');
}

async function notifyParent(ticket, content, conn) {
  const order = await one('SELECT o.parent_id, st.name AS student_name FROM orders o JOIN students st ON st.id=o.student_id WHERE o.id=?',
    [ticket.order_id]);
  if (order?.parent_id) await notify(order.parent_id, '售后进度更新', `${order.student_name}：${content}`, conn);
}

// 客服留言（处理中沟通）
export async function addTicketNote(formData) {
  const s = await requireService();
  const ticketId = num(formData.get('ticket_id'));
  const back = `/service/tickets/${ticketId}`;
  const note = str(formData.get('note'), 500);
  if (!note) fail(back, '请填写留言内容');
  const ticket = await one('SELECT * FROM aftersales WHERE id=?', [ticketId]);
  if (!ticket) fail('/service', '工单不存在');
  await tx(async (conn) => {
    await logEvent('AFTERSALE', ticketId, 'NOTE', { id: s.uid, name: s.name }, note, conn);
    await notifyParent(ticket, `工单 ${ticket.ticket_no} 客服留言：${note}`, conn);
  });
  revalidatePath('/');
  ok(back, '留言已发送给家长');
}
