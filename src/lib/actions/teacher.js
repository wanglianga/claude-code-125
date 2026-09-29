'use server';

import { revalidatePath } from 'next/cache';
import { one, q, tx } from '../db';
import { getSession } from '../session';
import { logEvent, notify, nextNo } from '../queries';
import { ok, fail, str, num } from './_shared';

async function requireTeacher() {
  const s = await getSession();
  if (!s || (s.role !== 'TEACHER' && s.role !== 'ADMIN')) fail('/login', '请以班主任身份登录');
  return s;
}

async function teacherClass(uid) {
  return one('SELECT * FROM classes WHERE teacher_id=?', [uid]);
}

// 班主任创建试穿时段
export async function createFittingSession(formData) {
  const s = await requireTeacher();
  const back = str(formData.get('redirect_to')) || '/teacher/fittings';
  const cls = await teacherClass(s.uid);
  if (!cls) fail(back, '您尚未绑定班级');
  const planId = num(formData.get('plan_id'));
  const slotStart = str(formData.get('slot_start'), 30);
  const slotEnd = str(formData.get('slot_end'), 30);
  if (!planId || !slotStart || !slotEnd) fail(back, '请填写完整的试穿时段信息');
  await tx(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO fitting_sessions (plan_id, class_id, slot_start, slot_end, location, created_by) VALUES (?,?,?,?,?,?)',
      [planId, cls.id, slotStart.replace('T', ' '), slotEnd.replace('T', ' '), str(formData.get('location'), 100), s.uid]
    );
    await logEvent('PLAN', planId, 'FITTING_SESSION_CREATED', { id: s.uid, name: s.name },
      `${cls.name} 试穿时段 ${slotStart} @${str(formData.get('location'), 100) || '待定'}`, conn);
    const parents = await q(
      'SELECT DISTINCT parent_id FROM students WHERE class_id=? AND parent_id IS NOT NULL AND status=\'ACTIVE\'', [cls.id]);
    for (const p of parents) {
      await notify(p.parent_id, '试穿通知', `${cls.name} 校服试穿安排在 ${slotStart.replace('T', ' ')}，请提醒孩子按时参加。`, conn);
    }
  });
  revalidatePath('/');
  ok(back, '试穿时段已创建，并已通知本班家长');
}

// 工作人员/班主任录入试穿记录（批量）
export async function saveFittingRecords(formData) {
  const s = await requireTeacher();
  const sessionId = num(formData.get('session_id'));
  const back = str(formData.get('redirect_to')) || '/teacher/fittings';
  const session = await one('SELECT * FROM fitting_sessions WHERE id=?', [sessionId]);
  if (!session) fail(back, '试穿时段不存在');
  const students = await q('SELECT * FROM students WHERE class_id=? AND status=\'ACTIVE\' ORDER BY student_no', [session.class_id]);
  let count = 0;
  await tx(async (conn) => {
    for (const stu of students) {
      const top = str(formData.get(`top_${stu.id}`), 10);
      const pants = str(formData.get(`pants_${stu.id}`), 10);
      const skirt = str(formData.get(`skirt_${stu.id}`), 10);
      const coat = str(formData.get(`coat_${stu.id}`), 10);
      const shoe = str(formData.get(`shoe_${stu.id}`), 10);
      const note = str(formData.get(`note_${stu.id}`), 255);
      if (!top && !pants && !skirt && !coat && !shoe && !note) continue;
      await conn.query(
        `INSERT INTO fitting_records (session_id, student_id, staff_id, top_size, pants_size, skirt_size, coat_size, shoe_size, note)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE staff_id=VALUES(staff_id), top_size=VALUES(top_size), pants_size=VALUES(pants_size),
           skirt_size=VALUES(skirt_size), coat_size=VALUES(coat_size), shoe_size=VALUES(shoe_size), note=VALUES(note)`,
        [sessionId, stu.id, s.uid, top, pants, skirt, coat, shoe, note]
      );
      count++;
      if (stu.parent_id) {
        await notify(stu.parent_id, '试穿结果已出',
          `${stu.name} 的试穿建议尺码已录入（上衣${top || '-'} 裤${pants || '-'} 裙${skirt || '-'} 外套${coat || '-'} 鞋${shoe || '-'}），请登录确认订单。`, conn);
      }
    }
    await logEvent('PLAN', session.plan_id, 'FITTING_RECORDS_SAVED', { id: s.uid, name: s.name },
      `录入试穿记录 ${count} 条（时段#${sessionId}）`, conn);
  });
  revalidatePath('/');
  ok(back, `已保存 ${count} 条试穿记录`);
}

// 创建发放/补领安排（自动带出可发放的订单）
export async function createDistribution(formData) {
  const s = await requireTeacher();
  const back = str(formData.get('redirect_to')) || '/teacher/distributions';
  const cls = s.role === 'TEACHER' ? await teacherClass(s.uid) : null;
  const classId = cls ? cls.id : num(formData.get('class_id'));
  const planId = num(formData.get('plan_id'));
  const type = str(formData.get('type'), 10) === 'MAKEUP' ? 'MAKEUP' : 'NORMAL';
  const slotStart = str(formData.get('slot_start'), 30);
  const slotEnd = str(formData.get('slot_end'), 30);
  if (!classId || !planId || !slotStart || !slotEnd) fail(back, '请填写完整的发放安排');

  // 可发放订单：本班、已到校、且最新签收状态不是 SIGNED；补领场次只带 MISSED/未到
  const eligible = await q(
    `SELECT o.id AS order_id, o.student_id FROM orders o
     JOIN students st ON st.id=o.student_id
     WHERE o.plan_id=? AND st.class_id=? AND o.status='CONFIRMED'
       AND EXISTS (SELECT 1 FROM shipment_orders so JOIN shipments sh ON sh.id=so.shipment_id
                   WHERE so.order_id=o.id AND sh.status='ARRIVED')
       AND NOT EXISTS (SELECT 1 FROM distribution_records dr WHERE dr.order_id=o.id AND dr.status='SIGNED')
       ${type === 'MAKEUP' ? 'AND EXISTS (SELECT 1 FROM distribution_records dr2 WHERE dr2.order_id=o.id AND dr2.status=\'MISSED\')' : ''}`,
    [planId, classId]
  );
  if (!eligible.length) fail(back, type === 'MAKEUP' ? '当前没有需要补领的学生' : '本班暂无已到校且未签收的订单');

  await tx(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO distributions (plan_id, class_id, title, slot_start, slot_end, location, type, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [planId, classId, str(formData.get('title'), 100) || (type === 'MAKEUP' ? '补领专场' : '分批发放'),
       slotStart.replace('T', ' '), slotEnd.replace('T', ' '), str(formData.get('location'), 100), type, s.uid]
    );
    const distId = r.insertId;
    for (const e of eligible) {
      await conn.query('INSERT IGNORE INTO distribution_records (distribution_id, order_id, student_id) VALUES (?,?,?)',
        [distId, e.order_id, e.student_id]);
    }
    await logEvent('PLAN', planId, 'DISTRIBUTION_CREATED', { id: s.uid, name: s.name },
      `${type === 'MAKEUP' ? '补领专场' : '分批发放'} #${distId}：${eligible.length} 人，${slotStart}`, conn);
    const parents = await q(
      `SELECT DISTINCT st.parent_id, st.name FROM students st WHERE st.class_id=? AND st.parent_id IS NOT NULL
         AND st.id IN (${eligible.map(() => '?').join(',')})`,
      [classId, ...eligible.map((e) => e.student_id)]);
    for (const p of parents) {
      await notify(p.parent_id, type === 'MAKEUP' ? '补领通知' : '发放通知',
        `${p.name} 的校服${type === 'MAKEUP' ? '补领' : '发放'}安排在 ${slotStart.replace('T', ' ')}，地点：${str(formData.get('location'), 100) || '待定'}。`, conn);
    }
  });
  revalidatePath('/');
  ok(back, `发放安排已创建，覆盖 ${eligible.length} 名学生`);
}

// 发放现场登记：签收 / 未到
export async function markDistributionRecord(formData) {
  const s = await requireTeacher();
  const recordId = num(formData.get('record_id'));
  const status = str(formData.get('status'), 10);
  const back = str(formData.get('redirect_to')) || '/teacher/distributions';
  if (!['SIGNED', 'MISSED', 'PENDING'].includes(status)) fail(back, '非法状态');
  const rec = await one(
    `SELECT dr.*, o.id AS oid, o.order_no, st.name AS student_name, st.parent_id
     FROM distribution_records dr JOIN orders o ON o.id=dr.order_id JOIN students st ON st.id=dr.student_id
     WHERE dr.id=?`, [recordId]);
  if (!rec) fail(back, '记录不存在');
  await tx(async (conn) => {
    await conn.query('UPDATE distribution_records SET status=?, signed_by=?, signed_at=? WHERE id=?',
      [status, status === 'SIGNED' ? (str(formData.get('signed_by'), 50) || s.name) : null,
       status === 'SIGNED' ? new Date() : null, recordId]);
    await logEvent('ORDER', rec.oid, status === 'SIGNED' ? 'DISTRIBUTION_SIGNED' : 'DISTRIBUTION_MISSED',
      { id: s.uid, name: s.name },
      status === 'SIGNED' ? `发放签收（${rec.order_no}），签收人：${str(formData.get('signed_by'), 50) || s.name}` : '发放未到，待安排补领', conn);
    if (rec.parent_id) {
      await notify(rec.parent_id, status === 'SIGNED' ? '签收成功' : '未领取提醒',
        status === 'SIGNED'
          ? `${rec.student_name} 的校服已签收，如有尺码问题可在7日内申请换码。`
          : `${rec.student_name} 未在本次发放时段领取校服，请关注补领安排。`, conn);
    }
  });
  revalidatePath('/');
  ok(back, '已登记');
}

// 结束一场发放
export async function completeDistribution(formData) {
  const s = await requireTeacher();
  const distId = num(formData.get('distribution_id'));
  const back = str(formData.get('redirect_to')) || '/teacher/distributions';
  await tx(async (conn) => {
    await conn.query('UPDATE distributions SET status=\'DONE\' WHERE id=?', [distId]);
    await conn.query('UPDATE distribution_records SET status=\'MISSED\' WHERE distribution_id=? AND status=\'PENDING\'', [distId]);
    await logEvent('PLAN', num(formData.get('plan_id')), 'DISTRIBUTION_DONE', { id: s.uid, name: s.name },
      `发放场次 #${distId} 已结束，未领取学生转入待补领`, conn);
  });
  revalidatePath('/');
  ok(back, '本场发放已结束，未领取学生已标记为待补领');
}
