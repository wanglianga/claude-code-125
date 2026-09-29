'use server';

import { revalidatePath } from 'next/cache';
import { one, q, tx } from '../db';
import { getSession } from '../session';
import { logEvent, notify, notifyRole, nextNo } from '../queries';
import { ok, fail, str, num } from './_shared';

async function requireParent() {
  const s = await getSession();
  if (!s || s.role !== 'PARENT') fail('/login', '请以家长身份登录');
  return s;
}

async function ownStudent(studentId, uid) {
  const stu = await one('SELECT * FROM students WHERE id=? AND parent_id=?', [studentId, uid]);
  return stu;
}

// 家长填写/更新学生体型信息
export async function saveMeasurement(formData) {
  const s = await requireParent();
  const studentId = num(formData.get('student_id'));
  const planId = num(formData.get('plan_id'));
  const back = str(formData.get('redirect_to')) || '/parent';
  if (!(await ownStudent(studentId, s.uid))) fail(back, '无权操作该学生');
  const special = formData.get('special_fit') ? 1 : 0;
  await tx(async (conn) => {
    await conn.query(
      `INSERT INTO measurements (student_id, plan_id, height, weight, usual_top, usual_bottom, usual_shoes, special_fit, special_note)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE height=VALUES(height), weight=VALUES(weight), usual_top=VALUES(usual_top),
         usual_bottom=VALUES(usual_bottom), usual_shoes=VALUES(usual_shoes),
         special_fit=VALUES(special_fit), special_note=VALUES(special_note)`,
      [
        studentId, planId,
        num(formData.get('height')), num(formData.get('weight')),
        str(formData.get('usual_top'), 10), str(formData.get('usual_bottom'), 10), str(formData.get('usual_shoes'), 10),
        special, str(formData.get('special_note')),
      ]
    );
    await logEvent('STUDENT', studentId, 'MEASUREMENT_SAVED', { id: s.uid, name: s.name }, '家长更新学生体型信息', conn);
  });
  revalidatePath('/');
  ok(back, '体型信息已保存');
}

// 家长确认订单（按试穿建议尺码预选，可修改；增购件可选数量）
export async function confirmOrder(formData) {
  const s = await requireParent();
  const studentId = num(formData.get('student_id'));
  const planId = num(formData.get('plan_id'));
  const back = str(formData.get('redirect_to')) || '/parent';
  const stu = await ownStudent(studentId, s.uid);
  if (!stu) fail(back, '无权操作该学生');
  if (stu.status !== 'ACTIVE') fail(back, '学生已转学，无法下单');

  const plan = await one('SELECT * FROM order_plans WHERE id=?', [planId]);
  if (!plan || !['OPEN', 'FITTING', 'ORDERING'].includes(plan.status)) fail(back, '当前计划不在订购阶段');
  const existing = await one('SELECT id FROM orders WHERE plan_id=? AND student_id=?', [planId, studentId]);
  if (existing) fail(back, '该学生已存在订单，请勿重复提交');

  const items = await q('SELECT * FROM plan_items WHERE plan_id=? ORDER BY id', [planId]);
  if (!items.length) fail(back, '计划尚未配置校服项目');

  const chosen = [];
  for (const it of items) {
    const qty = it.required ? 1 : Math.min(5, Math.max(0, num(formData.get(`qty_${it.id}`)) || 0));
    if (qty === 0) continue;
    const size = str(formData.get(`size_${it.id}`), 20) || '均码';
    chosen.push({ ...it, qty, size });
  }
  if (!chosen.length) fail(back, '请至少选择一项校服');

  const total = chosen.reduce((sum, it) => sum + Number(it.price) * it.qty, 0);
  const discount = stu.is_poverty ? Math.round((total * plan.poverty_discount) / 100 * 100) / 100 : 0;
  const finalAmount = Math.max(0, total - discount);

  try {
    await tx(async (conn) => {
      const orderNo = await nextNo(conn, 'orders', 'U2026-');
      const [r] = await conn.query(
        `INSERT INTO orders (order_no, plan_id, student_id, parent_id, total_amount, discount_amount, final_amount, note)
         VALUES (?,?,?,?,?,?,?,?)`,
        [orderNo, planId, studentId, s.uid, total, discount, finalAmount,
         discount > 0 ? `贫困生减免${plan.poverty_discount}%` : null]
      );
      const orderId = r.insertId;
      for (const it of chosen) {
        await conn.query(
          'INSERT INTO order_items (order_id, plan_item_id, item_name, category, part, size, qty, price) VALUES (?,?,?,?,?,?,?,?)',
          [orderId, it.id, it.name, it.category, it.part, it.size, it.qty, it.price]
        );
      }
      await logEvent('ORDER', orderId, 'ORDER_CONFIRMED', { id: s.uid, name: s.name },
        `家长确认订单 ${orderNo}，金额 ¥${total.toFixed(2)}${discount ? `，减免 ¥${discount.toFixed(2)}，实缴 ¥${finalAmount.toFixed(2)}` : ''}`, conn);
      // 通知班主任与总务
      const teacher = await one(
        'SELECT u.id FROM classes c JOIN users u ON u.id=c.teacher_id WHERE c.id=?', [stu.class_id]);
      if (teacher) await notify(teacher.id, '新订单确认', `${stu.name} 的校服订单 ${orderNo} 已确认，待缴费。`, conn);
    });
  } catch (e) {
    fail(back, '下单失败：' + e.message);
  }
  revalidatePath('/');
  ok(back, '订单已确认，请及时缴费');
}

// 家长缴费（模拟在线支付）
export async function payOrder(formData) {
  const s = await requireParent();
  const orderId = num(formData.get('order_id'));
  const back = str(formData.get('redirect_to')) || '/parent';
  const order = await one('SELECT * FROM orders WHERE id=? AND parent_id=?', [orderId, s.uid]);
  if (!order) fail(back, '订单不存在或无权操作');
  if (order.status !== 'CONFIRMED') fail(back, '订单已取消，无法缴费');
  if (order.pay_status !== 'UNPAID') fail(back, '订单已缴费，请勿重复支付');
  const plan = await one('SELECT * FROM order_plans WHERE id=?', [order.plan_id]);
  const late = plan?.pay_deadline && new Date() > new Date(plan.pay_deadline + 'T23:59:59') ? 1 : 0;

  await tx(async (conn) => {
    await conn.query('INSERT INTO payments (order_id, amount, type, method, operator_id, remark) VALUES (?,?,?,?,?,?)',
      [orderId, order.final_amount, 'PAY', 'ONLINE', s.uid, late ? '迟缴费' : null]);
    await conn.query('UPDATE orders SET pay_status=?, paid_at=NOW(), is_late=? WHERE id=?',
      ['PAID', late, orderId]);
    await logEvent('ORDER', orderId, late ? 'PAYMENT_LATE' : 'PAYMENT_PAID', { id: s.uid, name: s.name },
      `${late ? `迟缴费：超过截止日 ${plan.pay_deadline} ` : ''}在线缴费 ¥${Number(order.final_amount).toFixed(2)}`, conn);
    const stu = await one('SELECT * FROM students WHERE id=?', [order.student_id]);
    const teacher = await one('SELECT u.id FROM classes c JOIN users u ON u.id=c.teacher_id WHERE c.id=?', [stu.class_id]);
    if (teacher) await notify(teacher.id, late ? '迟缴费到账' : '缴费到账',
      `${stu.name} 的订单 ${order.order_no} 已缴费 ¥${Number(order.final_amount).toFixed(2)}${late ? '（迟缴费）' : ''}。`, conn);
    if (late) await notifyRole('ADMIN', '迟缴费提醒', `${stu.name} 的订单 ${order.order_no} 在截止日后完成缴费。`, conn);
  });
  revalidatePath('/');
  ok(back, late ? '缴费成功（已记录为迟缴费）' : '缴费成功');
}

// 家长线上确认签收
export async function confirmSign(formData) {
  const s = await requireParent();
  const recordId = num(formData.get('record_id'));
  const back = str(formData.get('redirect_to')) || '/parent';
  const rec = await one(
    `SELECT dr.*, o.parent_id, o.id AS oid, o.order_no, st.name AS student_name
     FROM distribution_records dr JOIN orders o ON o.id=dr.order_id JOIN students st ON st.id=dr.student_id
     WHERE dr.id=?`, [recordId]);
  if (!rec || rec.parent_id !== s.uid) fail(back, '无权操作该签收记录');
  if (rec.status === 'SIGNED') fail(back, '已签收，请勿重复操作');
  await tx(async (conn) => {
    await conn.query('UPDATE distribution_records SET status=?, signed_by=?, signed_at=NOW() WHERE id=?',
      ['SIGNED', s.name, recordId]);
    await logEvent('ORDER', rec.oid, 'DISTRIBUTION_SIGNED', { id: s.uid, name: s.name },
      `家长线上确认签收（${rec.order_no}）`, conn);
  });
  revalidatePath('/');
  ok(back, '签收成功，如有尺码问题可在售后中申请换码');
}

// 家长提交售后申请（换码/补发/退款/投诉/过敏/错领）
export async function submitAftersale(formData) {
  const s = await requireParent();
  const orderId = num(formData.get('order_id'));
  const back = str(formData.get('redirect_to')) || '/parent';
  const order = await one('SELECT * FROM orders WHERE id=? AND parent_id=?', [orderId, s.uid]);
  if (!order) fail(back, '订单不存在或无权操作');
  const type = str(formData.get('type'), 20);
  const reason = str(formData.get('reason'), 500);
  if (!type || !reason) fail(back, '请填写售后类型与原因');

  const orderItemId = num(formData.get('order_item_id'));
  let itemDesc = str(formData.get('item_desc'), 100);
  if (orderItemId) {
    const oi = await one('SELECT * FROM order_items WHERE id=? AND order_id=?', [orderItemId, orderId]);
    if (oi) itemDesc = oi.item_name;
  }
  await tx(async (conn) => {
    const ticketNo = await nextNo(conn, 'aftersales', 'AS2026-');
    const [r] = await conn.query(
      `INSERT INTO aftersales (ticket_no, order_id, order_item_id, student_id, type, item_desc, from_size, to_size, reason, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [ticketNo, orderId, orderItemId || null, order.student_id, type, itemDesc,
       str(formData.get('from_size'), 20), str(formData.get('to_size'), 20), reason, s.uid]
    );
    await logEvent('ORDER', orderId, 'AFTERSALE_SUBMITTED', { id: s.uid, name: s.name },
      `提交售后工单 ${ticketNo}（${type}）：${reason.slice(0, 80)}`, conn);
    await logEvent('AFTERSALE', r.insertId, 'SUBMITTED', { id: s.uid, name: s.name }, `工单 ${ticketNo} 已提交`, conn);
    await notifyRole('SERVICE', '新售后工单', `工单 ${ticketNo}（${type}）待受理，学生订单 ${order.order_no}。`, conn);
  });
  revalidatePath('/');
  ok(back, '售后申请已提交，客服将尽快处理');
}
