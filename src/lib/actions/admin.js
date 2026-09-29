'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { one, q, tx } from '../db';
import { getSession } from '../session';
import { logEvent, notify, notifyRole, nextNo } from '../queries';
import { ok, fail, str, num } from './_shared';

async function requireAdmin() {
  const s = await getSession();
  if (!s || s.role !== 'ADMIN') fail('/login', '请以总务身份登录');
  return s;
}

// ===== 基础数据维护 =====
export async function createCampus(formData) {
  await requireAdmin();
  const back = '/admin/base';
  const name = str(formData.get('name'), 100);
  if (!name) fail(back, '请填写校区名称');
  await q('INSERT INTO campuses (name) VALUES (?)', [name]);
  revalidatePath('/');
  ok(back, '校区已创建');
}

export async function createGrade(formData) {
  await requireAdmin();
  const back = '/admin/base';
  const name = str(formData.get('name'), 50);
  const campusId = num(formData.get('campus_id'));
  if (!name || !campusId) fail(back, '请填写年级名称并选择校区');
  await q('INSERT INTO grades (campus_id, name, is_graduating) VALUES (?,?,?)',
    [campusId, name, formData.get('is_graduating') ? 1 : 0]);
  revalidatePath('/');
  ok(back, '年级已创建');
}

export async function createClass(formData) {
  await requireAdmin();
  const back = '/admin/base';
  const name = str(formData.get('name'), 50);
  const gradeId = num(formData.get('grade_id'));
  if (!name || !gradeId) fail(back, '请填写班级名称并选择年级');
  await q('INSERT INTO classes (grade_id, name, teacher_id) VALUES (?,?,?)',
    [gradeId, name, num(formData.get('teacher_id'))]);
  revalidatePath('/');
  ok(back, '班级已创建');
}

export async function createUser(formData) {
  await requireAdmin();
  const back = '/admin/base';
  const username = str(formData.get('username'), 50);
  const name = str(formData.get('name'), 50);
  const role = str(formData.get('role'), 20);
  const password = str(formData.get('password'), 50) || '123456';
  if (!username || !name || !role) fail(back, '请填写完整的账号信息');
  const exists = await one('SELECT id FROM users WHERE username=?', [username]);
  if (exists) fail(back, '账号名已存在');
  await q(
    'INSERT INTO users (username, password_hash, name, role, campus_id, supplier_id, phone) VALUES (?,?,?,?,?,?,?)',
    [username, bcrypt.hashSync(password, 10), name, role,
     num(formData.get('campus_id')), num(formData.get('supplier_id')), str(formData.get('phone'), 30)]
  );
  revalidatePath('/');
  ok(back, `账号 ${username} 已创建（初始密码 ${password}）`);
}

export async function createStudent(formData) {
  await requireAdmin();
  const back = '/admin/base';
  const name = str(formData.get('name'), 50);
  const studentNo = str(formData.get('student_no'), 30);
  const classId = num(formData.get('class_id'));
  if (!name || !studentNo || !classId) fail(back, '请填写学生姓名、学号并选择班级');
  const exists = await one('SELECT id FROM students WHERE student_no=?', [studentNo]);
  if (exists) fail(back, '学号已存在');
  // 可同时创建/绑定家长账号
  const parentUsername = str(formData.get('parent_username'), 50);
  let parentId = null;
  await tx(async (conn) => {
    if (parentUsername) {
      const [p] = await conn.query('SELECT id FROM users WHERE username=?', [parentUsername]);
      if (p.length) {
        parentId = p[0].id;
      } else {
        const parentName = str(formData.get('parent_name'), 50) || `${name}家长`;
        const [r] = await conn.query(
          'INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,?)',
          [parentUsername, bcrypt.hashSync('123456', 10), parentName, 'PARENT']);
        parentId = r.insertId;
      }
    }
    await conn.query(
      'INSERT INTO students (class_id, student_no, name, gender, parent_id, is_poverty) VALUES (?,?,?,?,?,?)',
      [classId, studentNo, name, str(formData.get('gender'), 10) || '男', parentId,
       formData.get('is_poverty') ? 1 : 0]
    );
  });
  revalidatePath('/');
  ok(back, parentUsername ? '学生已建档，家长账号初始密码 123456' : '学生已建档');
}

// ===== 订购计划 =====
export async function createPlan(formData) {
  const s = await requireAdmin();
  const back = '/admin/plans';
  const title = str(formData.get('title'), 100);
  const campusId = num(formData.get('campus_id'));
  const season = str(formData.get('season'), 20);
  if (!title || !campusId || !season) fail(back, '请填写计划名称、校区与季节');
  const classIds = formData.getAll('class_ids').map(Number).filter(Boolean);
  if (!classIds.length) fail(back, '请至少选择一个班级');
  let planId;
  await tx(async (conn) => {
    const [r] = await conn.query(
      'INSERT INTO order_plans (title, campus_id, season, status, pay_deadline, poverty_discount, remark, created_by) VALUES (?,?,?,?,?,?,?,?)',
      [title, campusId, season, 'OPEN', str(formData.get('pay_deadline'), 20) || null,
       num(formData.get('poverty_discount')) ?? 50, str(formData.get('remark')), s.uid]
    );
    planId = r.insertId;
    for (const cid of classIds) {
      await conn.query('INSERT IGNORE INTO plan_classes (plan_id, class_id) VALUES (?,?)', [planId, cid]);
    }
    await logEvent('PLAN', planId, 'PLAN_CREATED', { id: s.uid, name: s.name }, `订购计划「${title}」已创建`, conn);
  });
  revalidatePath('/');
  ok(`/admin/plans/${planId}`, '计划已创建，请继续配置校服项目');
}

export async function addPlanItem(formData) {
  await requireAdmin();
  const planId = num(formData.get('plan_id'));
  const back = `/admin/plans/${planId}`;
  const name = str(formData.get('name'), 50);
  const category = str(formData.get('category'), 10);
  const price = num(formData.get('price'));
  if (!name || !category || price === null) fail(back, '请填写项目名称、类别与价格');
  await q('INSERT INTO plan_items (plan_id, name, category, part, price, required) VALUES (?,?,?,?,?,?)',
    [planId, name, category, str(formData.get('part'), 10) || 'OTHER', price, formData.get('required') ? 1 : 0]);
  revalidatePath('/');
  ok(back, '项目已添加');
}

export async function deletePlanItem(formData) {
  await requireAdmin();
  const planId = num(formData.get('plan_id'));
  const back = `/admin/plans/${planId}`;
  await q('DELETE FROM plan_items WHERE id=? AND plan_id=?', [num(formData.get('item_id')), planId]);
  revalidatePath('/');
  ok(back, '项目已删除');
}

export async function updatePlanStatus(formData) {
  const s = await requireAdmin();
  const planId = num(formData.get('plan_id'));
  const back = `/admin/plans/${planId}`;
  const status = str(formData.get('status'), 20);
  const allowed = ['DRAFT', 'OPEN', 'FITTING', 'ORDERING', 'PRODUCING', 'DISTRIBUTING', 'COMPLETED', 'CLOSED'];
  if (!allowed.includes(status)) fail(back, '非法状态');
  await tx(async (conn) => {
    await conn.query('UPDATE order_plans SET status=? WHERE id=?', [status, planId]);
    await logEvent('PLAN', planId, 'PLAN_STATUS', { id: s.uid, name: s.name }, `计划状态调整为 ${status}`, conn);
  });
  revalidatePath('/');
  ok(back, '计划状态已更新');
}

// ===== 学生状态 =====
export async function togglePoverty(formData) {
  const s = await requireAdmin();
  const studentId = num(formData.get('student_id'));
  const back = str(formData.get('redirect_to')) || '/admin/base';
  await tx(async (conn) => {
    await conn.query('UPDATE students SET is_poverty = 1 - is_poverty WHERE id=?', [studentId]);
    const [rows] = await conn.query('SELECT is_poverty FROM students WHERE id=?', [studentId]);
    await logEvent('STUDENT', studentId, 'POVERTY_TOGGLED', { id: s.uid, name: s.name },
      `贫困生标识调整为 ${rows[0]?.is_poverty ? '是' : '否'}`, conn);
  });
  revalidatePath('/');
  ok(back, '贫困生标识已更新');
}

// 学生转学：取消订单，已缴费用自动退款
export async function markTransferred(formData) {
  const s = await requireAdmin();
  const studentId = num(formData.get('student_id'));
  const back = str(formData.get('redirect_to')) || '/admin/base';
  const stu = await one('SELECT * FROM students WHERE id=?', [studentId]);
  if (!stu) fail(back, '学生不存在');
  if (stu.status === 'TRANSFERRED') fail(back, '该学生已标记为转学');
  await tx(async (conn) => {
    await conn.query('UPDATE students SET status=\'TRANSFERRED\' WHERE id=?', [studentId]);
    const orders = await q('SELECT * FROM orders WHERE student_id=? AND status=\'CONFIRMED\'', [studentId]);
    for (const o of orders) {
      await conn.query('UPDATE orders SET status=\'CANCELLED\' WHERE id=?', [o.id]);
      await logEvent('ORDER', o.id, 'ORDER_CANCELLED', { id: s.uid, name: s.name },
        `学生${stu.name}转学，订单 ${o.order_no} 取消`, conn);
      if (o.pay_status === 'PAID') {
        await conn.query('INSERT INTO payments (order_id, amount, type, method, operator_id, remark) VALUES (?,?,?,?,?,?)',
          [o.id, o.final_amount, 'REFUND', 'ONLINE', s.uid, '学生转学，全额退款']);
        await conn.query('UPDATE orders SET pay_status=\'REFUNDED\' WHERE id=?', [o.id]);
        await logEvent('ORDER', o.id, 'PAYMENT_REFUND', { id: s.uid, name: s.name },
          `转学全额退款 ¥${Number(o.final_amount).toFixed(2)}`, conn);
      }
      if (stu.parent_id) {
        await notify(stu.parent_id, '转学退款',
          `${stu.name} 已办理转学，订单 ${o.order_no} 已取消${o.pay_status === 'PAID' ? `，¥${Number(o.final_amount).toFixed(2)} 已原路退回` : ''}。`, conn);
      }
    }
    await logEvent('STUDENT', studentId, 'TRANSFERRED', { id: s.uid, name: s.name },
      `学生${stu.name}标记为转学，关联订单 ${orders.length} 笔已处理`, conn);
  });
  revalidatePath('/');
  ok(back, '已办理转学，关联订单与退款已处理');
}

// ===== 生产批次 =====
export async function createBatch(formData) {
  const s = await requireAdmin();
  const planId = num(formData.get('plan_id'));
  const back = `/admin/plans/${planId}`;
  const supplierId = num(formData.get('supplier_id'));
  if (!supplierId) fail(back, '请选择供应商');
  const eligible = await q(
    'SELECT * FROM orders WHERE plan_id=? AND status=\'CONFIRMED\' AND pay_status=\'PAID\' AND batch_id IS NULL',
    [planId]);
  if (!eligible.length) fail(back, '没有可投产订单（需已确认且已缴费）');
  let batchId, batchNo;
  await tx(async (conn) => {
    batchNo = await nextNo(conn, 'production_batches', 'B2026-');
    const [r] = await conn.query(
      'INSERT INTO production_batches (batch_no, plan_id, supplier_id, note) VALUES (?,?,?,?)',
      [batchNo, planId, supplierId, str(formData.get('note'))]);
    batchId = r.insertId;
    for (const o of eligible) {
      await conn.query('UPDATE orders SET batch_id=? WHERE id=?', [batchId, o.id]);
      await logEvent('ORDER', o.id, 'BATCH_ASSIGNED', { id: s.uid, name: s.name },
        `订单并入生产批次 ${batchNo}`, conn);
    }
    await logEvent('BATCH', batchId, 'BATCH_CREATED', { id: s.uid, name: s.name },
      `批次 ${batchNo} 创建，含订单 ${eligible.length} 笔`, conn);
    const supplierUsers = await q('SELECT id FROM users WHERE role=\'SUPPLIER\' AND supplier_id=?', [supplierId]);
    for (const u of supplierUsers) {
      await notify(u.id, '新生产批次', `批次 ${batchNo} 已下达贵司，共 ${eligible.length} 笔订单，请安排生产。`, conn);
    }
    await notifyRole('FACTORY', '新生产批次', `批次 ${batchNo}（${eligible.length} 笔订单）待投产，请及时更新生产进度。`, conn);
  });
  revalidatePath('/');
  ok(`/admin/batches/${batchId}`, `批次 ${batchNo} 已创建，${eligible.length} 笔订单进入待投产`);
}

// ===== 催缴 =====
export async function sendPayReminders(formData) {
  const s = await requireAdmin();
  const planId = num(formData.get('plan_id'));
  const back = `/admin/plans/${planId}`;
  const plan = await one('SELECT * FROM order_plans WHERE id=?', [planId]);
  const unpaid = await q(
    `SELECT o.*, st.name AS student_name, st.parent_id FROM orders o JOIN students st ON st.id=o.student_id
     WHERE o.plan_id=? AND o.status='CONFIRMED' AND o.pay_status='UNPAID'`, [planId]);
  if (!unpaid.length) fail(back, '当前没有未缴费订单');
  await tx(async (conn) => {
    for (const o of unpaid) {
      if (o.parent_id) {
        await notify(o.parent_id, '缴费提醒',
          `${o.student_name} 的校服订单 ${o.order_no} 尚未缴费（¥${Number(o.final_amount).toFixed(2)}），缴费截止日为 ${plan.pay_deadline || '待定'}，请尽快完成。`, conn);
      }
    }
    await logEvent('PLAN', planId, 'PAY_REMINDED', { id: s.uid, name: s.name }, `催缴 ${unpaid.length} 笔未缴费订单`, conn);
  });
  revalidatePath('/');
  ok(back, `已向 ${unpaid.length} 位家长发送催缴提醒`);
}

// ===== 供应商考核 =====
export async function createAssessment(formData) {
  const s = await requireAdmin();
  const back = '/admin/assessments';
  const supplierId = num(formData.get('supplier_id'));
  if (!supplierId) fail(back, '请选择供应商');
  const sq = num(formData.get('score_quality'));
  const st = num(formData.get('score_timeliness'));
  const ss = num(formData.get('score_service'));
  if (!sq || !st || !ss) fail(back, '请填写三项评分（1-5）');
  await tx(async (conn) => {
    await conn.query(
      'INSERT INTO supplier_assessments (supplier_id, batch_id, score_quality, score_timeliness, score_service, comment, created_by) VALUES (?,?,?,?,?,?,?)',
      [supplierId, num(formData.get('batch_id')), sq, st, ss, str(formData.get('comment'), 500), s.uid]);
    const supplierUsers = await q('SELECT id FROM users WHERE role=\'SUPPLIER\' AND supplier_id=?', [supplierId]);
    for (const u of supplierUsers) {
      await notify(u.id, '收到考核评价', `学校对贵司完成了一次考核：质量${sq}分 / 交期${st}分 / 服务${ss}分。`, conn);
    }
  });
  revalidatePath('/');
  ok(back, '考核记录已保存');
}
