import { NextRequest } from 'next/server';
import { one, query, tx } from '@/lib/db';
import { api, ok, fail, logActivity } from '@/lib/api';

// 工单详情 + 换码/补发/退款子记录
export const GET = api(async (_req: NextRequest, _b: any, user, ctx) => {
  const id = ctx.params.id;
  const c = await one<any>(
    `SELECT ac.*, s.name student_name, s.student_no, c2.name class_name, o.order_no,
            u.real_name creator_name, u2.real_name assignee_name
     FROM aftersales_cases ac
     JOIN students s ON s.id=ac.student_id
     JOIN classes c2 ON c2.id=s.class_id
     LEFT JOIN orders o ON o.id=ac.order_id
     LEFT JOIN users u ON u.id=ac.created_by
     LEFT JOIN users u2 ON u2.id=ac.assigned_to
     WHERE ac.id=?`, [id]);
  if (!c) return fail('工单不存在', 404);
  const [exchanges, resends, refunds, logs] = await Promise.all([
    query('SELECT * FROM exchange_requests WHERE case_id=?', [id]),
    query('SELECT * FROM resend_records WHERE case_id=?', [id]),
    query('SELECT * FROM refund_records WHERE case_id=?', [id]),
    query('SELECT * FROM activity_log WHERE student_id=? ORDER BY id DESC LIMIT 30', [c.student_id]),
  ]);
  return ok({ case: c, exchanges, resends, refunds, logs });
});

export const POST = api(async (_req: NextRequest, body: any, user) => {
  const c = await one<any>('SELECT * FROM aftersales_cases WHERE id=?', [body.id]);
  if (!c) return fail('工单不存在', 404);

  // 售后客服/总务分派
  if (body.action === 'assign') {
    if (!['after_sales', 'general_affairs', 'admin', 'supplier', 'factory'].includes(user.role))
      return fail('无权限分派', 403);
    await query('UPDATE aftersales_cases SET assigned_to=?, status=CASE WHEN status=? THEN ? ELSE status END WHERE id=?',
      [body.assigned_to, 'open', 'processing', c.id]);
    await logActivity({ student_id: c.student_id, order_id: c.order_id, actor: user, action: '工单分派', detail: `处理人#${body.assigned_to}` });
    return ok();
  }

  // 换码：家长退回旧码 → 供应商重发新码 → 完成
  if (body.action === 'exchange') {
    if (c.type !== 'exchange') return fail('该工单不是换码类型');
    const oi = await one<any>('SELECT * FROM order_items WHERE id=?', [c.order_item_id || body.order_item_id]);
    if (!oi) return fail('订单明细不存在', 404);
    if (body.phase === 'request' && !body.new_size) return fail('请填写新尺码');
    await tx(async (conn) => {
      if (body.phase === 'request') {
        await conn.query(
          `INSERT INTO exchange_requests (case_id,order_item_id,old_size,new_size,status)
           VALUES (?,?,?,?, 'requested')`,
          [c.id, oi.id, body.old_size || oi.size, body.new_size]);
        await conn.query("UPDATE aftersales_cases SET status='processing' WHERE id=?", [c.id]);
      } else if (body.phase === 'returned') {
        await conn.query("UPDATE exchange_requests SET status='returned', return_tracking=COALESCE(?,return_tracking) WHERE case_id=? AND status='requested'",
          [body.tracking || null, c.id]);
      } else if (body.phase === 'reshipped') {
        await conn.query("UPDATE exchange_requests SET status='reshipped', reship_tracking=COALESCE(?,reship_tracking) WHERE case_id=? AND status='returned'",
          [body.tracking || null, c.id]);
      } else if (body.phase === 'done') {
        // 新码优先取本次入参，否则取换码申请记录
        let newSize = body.new_size;
        if (!newSize) {
          const ex = await one<any>('SELECT new_size FROM exchange_requests WHERE case_id=? ORDER BY id DESC LIMIT 1', [c.id]);
          newSize = ex?.new_size;
        }
        await conn.query("UPDATE exchange_requests SET status='done' WHERE case_id=? AND status='reshipped'", [c.id]);
        // 更新订单明细为新码（同一批校服换码留痕）
        await conn.query('UPDATE order_items SET size=? WHERE id=?', [newSize, oi.id]);
        await conn.query("UPDATE aftersales_cases SET status='resolved', resolution=COALESCE(?,resolution), resolved_at=NOW() WHERE id=?",
          [body.resolution || `换码完成 → ${newSize}`, c.id]);
      }
    });
    await logActivity({ student_id: c.student_id, order_id: c.order_id, actor: user,
      action: '换码处理', detail: `${body.phase} ${body.old_size || ''}→${body.new_size || ''}` });
    return ok();
  }

  // 补发（工厂漏发/错领找不回）：请求 → 发货 → 到校 → 完成
  if (body.action === 'resend') {
    if (c.type !== 'resend' && c.type !== 'wrong_claim') return fail('该工单不支持补发');
    await tx(async (conn) => {
      if (body.phase === 'request') {
        await conn.query(
          `INSERT INTO resend_records (case_id,order_item_id,plan_item_id,size,qty,status)
           VALUES (?,?,?,?,?, 'requested')`,
          [c.id, body.order_item_id || c.order_item_id, body.plan_item_id || null,
           body.size || null, body.qty || 1]);
        await conn.query("UPDATE aftersales_cases SET status='processing' WHERE id=?", [c.id]);
      } else if (body.phase === 'shipped') {
        await conn.query("UPDATE resend_records SET status='shipped', tracking_no=? WHERE case_id=? AND status='requested'",
          [body.tracking || null, c.id]);
      } else if (body.phase === 'arrived') {
        await conn.query("UPDATE resend_records SET status='arrived' WHERE case_id=? AND status='shipped'", [c.id]);
      } else if (body.phase === 'done') {
        await conn.query("UPDATE resend_records SET status='done' WHERE case_id=? AND status='arrived'", [c.id]);
        await conn.query("UPDATE aftersales_cases SET status='resolved', resolution=COALESCE(?,resolution), resolved_at=NOW() WHERE id=?",
          [body.resolution || '补发完成', c.id]);
        // 关联缺件/错领签收记录闭环
        if (c.order_item_id) {
          await conn.query('UPDATE receipts SET handled=1 WHERE order_item_id=? AND handled=0', [c.order_item_id]);
        }
      }
    });
    await logActivity({ student_id: c.student_id, order_id: c.order_id, actor: user,
      action: '补发处理', detail: body.phase });
    return ok();
  }

  // 退款（转学/迟缴取消/面料过敏退货）
  if (body.action === 'refund') {
    if (c.type !== 'refund' && c.type !== 'transfer_cancel' && c.type !== 'complaint')
      return fail('该工单不支持退款');
    await tx(async (conn) => {
      if (body.phase === 'request') {
        if (!body.amount) throw Object.assign(new Error('请填写退款金额'), { status: 400 });
        await conn.query(
          `INSERT INTO refund_records (case_id,amount,reason,status) VALUES (?,?,?, 'requested')`,
          [c.id, body.amount, body.reason || c.reason]);
        await conn.query("UPDATE aftersales_cases SET status='processing' WHERE id=?", [c.id]);
      } else if (body.phase === 'approve') {
        await conn.query("UPDATE refund_records SET status='approved' WHERE case_id=? AND status='requested'", [c.id]);
      } else if (body.phase === 'refunded') {
        await conn.query("UPDATE refund_records SET status='refunded', refunded_at=NOW() WHERE case_id=? AND status='approved'", [c.id]);
        await conn.query("UPDATE aftersales_cases SET status='resolved', resolution=COALESCE(?,resolution), resolved_at=NOW() WHERE id=?",
          [body.resolution || '退款完成', c.id]);
        if (c.order_id) {
          await conn.query("UPDATE orders SET status='cancelled', cancelled_at=NOW() WHERE id=? AND status='hold'", [c.order_id]);
        }
      } else if (body.phase === 'reject') {
        await conn.query("UPDATE refund_records SET status='rejected' WHERE case_id=? AND status='requested'", [c.id]);
        await conn.query("UPDATE aftersales_cases SET status='rejected', resolution=? WHERE id=?", [body.reason || '退款驳回', c.id]);
      }
    });
    await logActivity({ student_id: c.student_id, order_id: c.order_id, actor: user,
      action: '退款处理', detail: `${body.phase} ${body.amount || ''}` });
    return ok();
  }

  // 投诉（面料过敏）处理结论
  if (body.action === 'resolve') {
    await query("UPDATE aftersales_cases SET status='resolved', resolution=?, resolved_at=NOW() WHERE id=?",
      [body.resolution || '已处理', c.id]);
    await logActivity({ student_id: c.student_id, order_id: c.order_id, actor: user,
      action: '工单解决', detail: body.resolution });
    return ok();
  }

  if (body.action === 'reject') {
    await query("UPDATE aftersales_cases SET status='rejected', resolution=?, resolved_at=NOW() WHERE id=?",
      [body.reason || '不予处理', c.id]);
    return ok();
  }

  return fail('未知操作');
});
