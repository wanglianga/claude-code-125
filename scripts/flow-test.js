// 业务流程测试：通过 Next.js 服务端动作的免 JS 表单协议（$ACTION_ID）真实提交表单
const BASE = 'http://localhost:3000';
const mysql = require('mysql2/promise');

const db = () => mysql.createConnection({ host: '127.0.0.1', port: 3306, user: 'uniform', password: 'uniform123', database: 'uniform' });

async function login(username) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' }),
  });
  return res.headers.get('set-cookie')?.split(';')[0];
}

async function getPage(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  return res.text();
}

// 从页面 HTML 中提取包含 marker 的表单的 $ACTION_ID
function extractActionId(html, marker) {
  const forms = html.match(/<form[\s\S]*?<\/form>/g) || [];
  for (const f of forms) {
    if (f.includes(marker)) {
      const m = f.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
      if (m) return m[1];
    }
  }
  return null;
}

// 以免 JS 方式提交服务端动作表单
async function submitAction(path, cookie, actionId, fields) {
  const fd = new FormData();
  fd.append(actionId, '');
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { cookie },
    body: fd,
    redirect: 'manual',
  });
  const location = res.headers.get('location') || '';
  return { status: res.status, location };
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

(async () => {
  // === 流程1：家长缴费（逾期 → 迟缴费标记）===
  console.log('流程1：家长缴费（迟缴费）');
  const cParent3 = await login('parent3');
  const childPage = '/parent/children/3?plan=1';
  let html = await getPage(childPage, cParent3);
  let aid = extractActionId(html, '立即缴费');
  check('找到缴费表单动作', !!aid);
  let r = await submitAction(childPage, cParent3, aid, { order_id: '3', redirect_to: childPage });
  check('缴费提交后重定向成功', r.status === 303 && decodeURIComponent(r.location).includes('ok='), `status=${r.status} loc=${r.location}`);
  let conn = await db();
  let [rows] = await conn.query('SELECT pay_status, is_late FROM orders WHERE id=3');
  check('订单3已缴费且标记迟缴', rows[0].pay_status === 'PAID' && rows[0].is_late === 1, JSON.stringify(rows[0]));
  const [pays] = await conn.query("SELECT COUNT(*) c FROM payments WHERE order_id=3 AND type='PAY'");
  check('缴费流水已登记', pays[0].c === 1);
  await conn.end();

  // === 流程2：售后客服办结换码工单 ===
  console.log('流程2：客服办结换码工单 AS2026-0001');
  const cService = await login('service1');
  const ticketPage = '/service/tickets/1';
  html = await getPage(ticketPage, cService);
  aid = extractActionId(html, '受理工单');
  check('找到受理动作', !!aid);
  r = await submitAction(ticketPage, cService, aid, { ticket_id: '1', action: 'accept' });
  check('受理成功', r.status === 303);
  html = await getPage(ticketPage, cService);
  aid = extractActionId(html, '办结工单');
  check('找到办结动作', !!aid);
  r = await submitAction(ticketPage, cService, aid, {
    ticket_id: '1', action: 'resolve', resolution: '已安排换码，新尺码随下一批发货', new_size: '140',
  });
  check('办结成功', r.status === 303);
  conn = await db();
  [rows] = await conn.query('SELECT status, resolution FROM aftersales WHERE id=1');
  check('工单1已解决', rows[0].status === 'RESOLVED', rows[0].status);
  [rows] = await conn.query('SELECT size FROM order_items WHERE id=1');
  check('订单明细尺码已更新为140', rows[0].size === '140', rows[0].size);
  const [evts] = await conn.query("SELECT COUNT(*) c FROM events WHERE entity='ORDER' AND entity_id=1 AND action='SIZE_EXCHANGED'");
  check('换码事件已留痕', evts[0].c === 1);
  await conn.end();

  // === 流程3：供应商发货 → 到校 → 批次自动 ARRIVED ===
  console.log('流程3：供应商发货到校');
  const cSupplier = await login('supplier1');
  const batchPage = '/supplier/batches/1';
  html = await getPage(batchPage, cSupplier);
  aid = extractActionId(html, '确认发货');
  check('找到确认发货动作', !!aid);
  r = await submitAction(batchPage, cSupplier, aid, { shipment_id: '2' });
  check('发货成功', r.status === 303);
  html = await getPage(batchPage, cSupplier);
  aid = extractActionId(html, '确认到校');
  check('找到确认到校动作', !!aid);
  r = await submitAction(batchPage, cSupplier, aid, { shipment_id: '2' });
  check('到校成功', r.status === 303);
  conn = await db();
  [rows] = await conn.query('SELECT status FROM production_batches WHERE id=1');
  check('批次全部到校后自动ARRIVED', rows[0].status === 'ARRIVED', rows[0].status);
  await conn.end();

  // === 流程4：总务创建新生产批次（迟缴+毕业班补订订单入批）===
  console.log('流程4：总务创建生产批次');
  const cAdmin = await login('admin');
  const planPage = '/admin/plans/1';
  html = await getPage(planPage, cAdmin);
  aid = extractActionId(html, '创建生产批次');
  check('找到创建批次动作', !!aid);
  r = await submitAction(planPage, cAdmin, aid, { plan_id: '1', supplier_id: '2', note: '第二批：迟缴与毕业班补订' });
  check('创建批次重定向', r.status === 303, `status=${r.status} loc=${r.location}`);
  conn = await db();
  [rows] = await conn.query('SELECT id, batch_no, supplier_id, status FROM production_batches ORDER BY id DESC LIMIT 1');
  check('新批次B2026-0002已创建', rows[0].batch_no === 'B2026-0002' && rows[0].supplier_id === 2, JSON.stringify(rows[0]));
  const [inBatch] = await conn.query('SELECT id FROM orders WHERE batch_id=? ORDER BY id', [rows[0].id]);
  check('已缴费未入批订单3,5,8全部入批', inBatch.map((o) => o.id).join(',') === '3,5,8', JSON.stringify(inBatch));
  await conn.end();

  // === 流程5：家长提交售后（漏发补发）===
  console.log('流程5：家长提交售后工单');
  const cParent1 = await login('parent1');
  const child1 = '/parent/children/1?plan=1';
  html = await getPage(child1, cParent1);
  aid = extractActionId(html, '提交售后申请');
  check('找到售后提交动作', !!aid);
  r = await submitAction(child1, cParent1, aid, {
    order_id: '1', redirect_to: child1, type: 'MISSING', order_item_id: '', from_size: '', to_size: '',
    reason: '运动鞋包裹漏发，请补发',
  });
  check('售后提交成功', r.status === 303);
  conn = await db();
  [rows] = await conn.query("SELECT ticket_no, type, status FROM aftersales ORDER BY id DESC LIMIT 1");
  check('新工单已生成', rows[0].type === 'MISSING' && rows[0].status === 'SUBMITTED', JSON.stringify(rows[0]));
  await conn.end();

  // === 流程6：班主任创建补领场次（刘欣然 MISSED → 补领）===
  console.log('流程6：班主任创建发放场次');
  const cWang = await login('wang');
  const distPage = '/teacher/distributions';
  html = await getPage(distPage, cWang);
  aid = extractActionId(html, '创建场次并通知家长');
  check('找到创建场次动作', !!aid);
  r = await submitAction(distPage, cWang, aid, {
    redirect_to: distPage, plan_id: '1', type: 'NORMAL', title: '一年级(1)班第二批发放',
    slot_start: '2026-10-09T14:00', slot_end: '2026-10-09T15:00', location: '本部校门大厅',
  });
  check('创建场次重定向', r.status === 303 && decodeURIComponent(r.location).includes('ok='), `loc=${r.location}`);
  conn = await db();
  [rows] = await conn.query('SELECT id, title FROM distributions ORDER BY id DESC LIMIT 1');
  check('新场次已创建', rows[0].title.includes('第二批'), JSON.stringify(rows[0]));
  const [distRecs] = await conn.query('SELECT COUNT(*) c FROM distribution_records WHERE distribution_id=?', [rows[0].id]);
  check('场次自动带出可发放订单', distRecs[0].c >= 1, `count=${distRecs[0].c}`);
  await conn.end();

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('流程测试异常:', e); process.exit(1); });
