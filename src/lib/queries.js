import { q, one, pool } from './db';

// ===== 事件与通知（所有角色围绕同一学生/同一批校服协作的留痕）=====
export async function logEvent(entity, entityId, action, actor, detail, conn) {
  const runner = conn || pool;
  await runner.query(
    'INSERT INTO events (entity, entity_id, action, actor_id, actor_name, detail) VALUES (?,?,?,?,?,?)',
    [entity, entityId, action, actor?.id || null, actor?.name || '系统', detail || null]
  );
}

export async function notify(userId, title, content, conn) {
  if (!userId) return;
  const runner = conn || pool;
  await runner.query('INSERT INTO notifications (user_id, title, content) VALUES (?,?,?)', [userId, title, content]);
}

export async function notifyRole(role, title, content, conn) {
  const users = await q('SELECT id FROM users WHERE role = ?', [role]);
  for (const u of users) await notify(u.id, title, content, conn);
}

// ===== 单学生在某计划下的进度 =====
export async function studentProgress(planId, studentId) {
  const [m, f, o] = await Promise.all([
    one('SELECT * FROM measurements WHERE plan_id=? AND student_id=?', [planId, studentId]),
    one(
      `SELECT fr.* FROM fitting_records fr
       JOIN fitting_sessions fs ON fs.id = fr.session_id
       WHERE fs.plan_id=? AND fr.student_id=? ORDER BY fr.id DESC LIMIT 1`,
      [planId, studentId]
    ),
    one('SELECT * FROM orders WHERE plan_id=? AND student_id=?', [planId, studentId]),
  ]);
  let batch = null, shipment = null, dist = null;
  if (o?.batch_id) batch = await one('SELECT * FROM production_batches WHERE id=?', [o.batch_id]);
  if (o) {
    shipment = await one(
      `SELECT s.* FROM shipments s JOIN shipment_orders so ON so.shipment_id=s.id
       WHERE so.order_id=? ORDER BY s.id DESC LIMIT 1`,
      [o.id]
    );
    dist = await one(
      'SELECT * FROM distribution_records WHERE order_id=? ORDER BY id DESC LIMIT 1',
      [o.id]
    );
  }
  const tickets = o ? await q('SELECT * FROM aftersales WHERE order_id=? ORDER BY id DESC', [o.id]) : [];
  return { measurement: m, fitting: f, order: o, batch, shipment, dist, tickets };
}

// ===== 班级维度进度汇总 =====
export async function planClassProgress(planId) {
  return q(
    `SELECT c.id, c.name AS class_name, g.name AS grade_name,
       (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.status='ACTIVE') AS students,
       (SELECT COUNT(*) FROM measurements m JOIN students s ON s.id=m.student_id
         WHERE s.class_id=c.id AND m.plan_id=?) AS measured,
       (SELECT COUNT(DISTINCT fr.student_id) FROM fitting_records fr
         JOIN fitting_sessions fs ON fs.id=fr.session_id
         JOIN students s ON s.id=fr.student_id
         WHERE s.class_id=c.id AND fs.plan_id=?) AS fitted,
       (SELECT COUNT(*) FROM orders o JOIN students s ON s.id=o.student_id
         WHERE s.class_id=c.id AND o.plan_id=? AND o.status='CONFIRMED') AS ordered,
       (SELECT COUNT(*) FROM orders o JOIN students s ON s.id=o.student_id
         WHERE s.class_id=c.id AND o.plan_id=? AND o.pay_status='PAID') AS paid,
       (SELECT COUNT(*) FROM orders o JOIN students s ON s.id=o.student_id
         WHERE s.class_id=c.id AND o.plan_id=? AND o.batch_id IS NOT NULL) AS in_batch,
       (SELECT COUNT(*) FROM distribution_records dr JOIN orders o ON o.id=dr.order_id
         JOIN students s ON s.id=o.student_id
         WHERE s.class_id=c.id AND o.plan_id=? AND dr.status='SIGNED') AS signed,
       (SELECT COUNT(*) FROM aftersales a JOIN students s ON s.id=a.student_id
         JOIN orders o ON o.id=a.order_id
         WHERE s.class_id=c.id AND o.plan_id=? AND a.status NOT IN ('RESOLVED','CLOSED','REJECTED')) AS open_tickets
     FROM classes c JOIN grades g ON g.id=c.grade_id
     JOIN plan_classes pc ON pc.class_id=c.id AND pc.plan_id=?
     ORDER BY c.id`,
    [planId, planId, planId, planId, planId, planId, planId, planId]
  );
}

// ===== 学生维度进度明细 =====
export async function planStudentProgress(planId, classId) {
  const params = [planId, planId, planId, planId, planId, planId, planId];
  let classFilter = '';
  if (classId) {
    classFilter = ' AND c.id = ?';
    params.push(classId);
  }
  return q(
    `SELECT s.id AS student_id, s.name AS student_name, s.student_no, s.is_poverty, s.status AS student_status,
       c.name AS class_name, c.id AS class_id,
       (SELECT 1 FROM measurements m WHERE m.plan_id=? AND m.student_id=s.id LIMIT 1) IS NOT NULL AS measured,
       (SELECT 1 FROM fitting_records fr JOIN fitting_sessions fs ON fs.id=fr.session_id
         WHERE fs.plan_id=? AND fr.student_id=s.id LIMIT 1) IS NOT NULL AS fitted,
       o.id AS order_id, o.order_no, o.status AS order_status, o.pay_status, o.is_late, o.final_amount,
       o.batch_id,
       (SELECT b.status FROM production_batches b WHERE b.id=o.batch_id) AS batch_status,
       (SELECT sh.status FROM shipments sh JOIN shipment_orders so ON so.shipment_id=sh.id
         WHERE so.order_id=o.id ORDER BY sh.id DESC LIMIT 1) AS shipment_status,
       (SELECT dr.status FROM distribution_records dr WHERE dr.order_id=o.id
         ORDER BY dr.id DESC LIMIT 1) AS dist_status,
       (SELECT COUNT(*) FROM aftersales a WHERE a.order_id=o.id
         AND a.status NOT IN ('RESOLVED','CLOSED','REJECTED')) AS open_tickets
     FROM students s
     JOIN classes c ON c.id=s.class_id
     JOIN plan_classes pc ON pc.class_id=c.id AND pc.plan_id=?
     LEFT JOIN orders o ON o.plan_id=? AND o.student_id=s.id
     WHERE 1=1 ${classFilter}
     ORDER BY c.id, s.student_no`,
    params
  );
}

// ===== 供应商视角：批次投产就绪情况 =====
export async function planReadiness(planId) {
  const ready = await q(
    `SELECT o.id, o.order_no, o.final_amount, s.name AS student_name, c.name AS class_name
     FROM orders o JOIN students s ON s.id=o.student_id JOIN classes c ON c.id=s.class_id
     WHERE o.plan_id=? AND o.status='CONFIRMED' AND o.pay_status='PAID' AND o.batch_id IS NULL
     ORDER BY o.id`,
    [planId]
  );
  const unpaid = await q(
    `SELECT o.id, o.order_no, o.final_amount, s.name AS student_name, c.name AS class_name, o.created_at
     FROM orders o JOIN students s ON s.id=o.student_id JOIN classes c ON c.id=s.class_id
     WHERE o.plan_id=? AND o.status='CONFIRMED' AND o.pay_status='UNPAID'
     ORDER BY o.id`,
    [planId]
  );
  const unconfirmed = await q(
    `SELECT s.id, s.name AS student_name, c.name AS class_name,
       (SELECT 1 FROM measurements m WHERE m.plan_id=? AND m.student_id=s.id LIMIT 1) IS NOT NULL AS measured
     FROM students s JOIN classes c ON c.id=s.class_id
     JOIN plan_classes pc ON pc.class_id=c.id AND pc.plan_id=?
     LEFT JOIN orders o ON o.plan_id=? AND o.student_id=s.id
     WHERE s.status='ACTIVE' AND o.id IS NULL
     ORDER BY c.id, s.student_no`,
    [planId, planId, planId]
  );
  return { ready, unpaid, unconfirmed };
}

// ===== 订单 360 时间线 =====
export async function orderTimeline(orderId) {
  const events = await q(
    'SELECT * FROM events WHERE entity=? AND entity_id=? ORDER BY created_at DESC, id DESC',
    ['ORDER', orderId]
  );
  const payments = await q('SELECT * FROM payments WHERE order_id=? ORDER BY id DESC', [orderId]);
  const tickets = await q('SELECT * FROM aftersales WHERE order_id=? ORDER BY id DESC', [orderId]);
  return { events, payments, tickets };
}

// ===== 单号生成（事务内调用）=====
export async function nextNo(conn, table, prefix) {
  const [rows] = await conn.query(`SELECT COUNT(*) AS c FROM ${table}`);
  return `${prefix}${String(rows[0].c + 1).padStart(4, '0')}`;
}
