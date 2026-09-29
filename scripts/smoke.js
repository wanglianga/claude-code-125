// 冒烟测试：各角色登录 + 关键页面可访问 + 关键内容存在
const BASE = 'http://localhost:3000';

async function login(username, password = '123456') {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { data, cookie };
}

async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
  const text = await res.text();
  return { status: res.status, text, location: res.headers.get('location') };
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

(async () => {
  // 1. 登录接口
  const bad = await login('admin', 'wrong');
  check('错误密码被拒绝', !bad.data.ok);
  const admin = await login('admin');
  check('admin 登录', admin.data.ok && admin.data.home === '/admin');

  // 2. 各角色登录与首页
  const roles = [
    ['admin', '/admin', '总务工作台'],
    ['wang', '/teacher', '班级总览'],
    ['parent1', '/parent', '我的孩子'],
    ['parent2', '/parent', '贫困生减免'],
    ['parent3', '/parent', '我的孩子'],
    ['supplier1', '/supplier', '供应商工作台'],
    ['factory1', '/factory', '工厂工作台'],
    ['service1', '/service', '售后工作台'],
  ];
  const cookies = {};
  for (const [u, home, marker] of roles) {
    const { data, cookie } = await login(u);
    cookies[u] = cookie;
    check(`${u} 登录→${home}`, data.ok && data.home === home);
    const page = await get(home, cookie);
    check(`${u} ${home} 包含「${marker}」`, page.status === 200 && page.text.includes(marker), `status=${page.status}`);
  }

  // 3. 未登录访问受保护页面 → 跳登录
  const noauth = await get('/admin', '');
  check('未登录访问 /admin 跳转登录', noauth.status === 307 && noauth.location.includes('/login'));

  // 4. 越权访问：家长访问 /admin → 跳走
  const forbidden = await get('/admin', cookies['parent1']);
  check('家长访问 /admin 被重定向', forbidden.status === 307);

  // 5. 关键业务页面
  const checks = [
    ['admin', '/admin/plans', '订购计划'],
    ['admin', '/admin/plans/1', '投产就绪'],
    ['admin', '/admin/plans/1', '未缴费不可投产'],
    ['admin', '/admin/batches/1', 'B2026-0001'],
    ['admin', '/admin/distributions', '补领'],
    ['admin', '/admin/aftersales', 'AS2026-0001'],
    ['admin', '/admin/assessments', '华美服饰'],
    ['admin', '/admin/base', '学生建档'],
    ['wang', '/teacher/fittings', '试穿管理'],
    ['wang', '/teacher/fittings/1', '试穿记录录入'],
    ['wang', '/teacher/distributions', '发放管理'],
    ['wang', '/teacher/distributions/1', '签收'],
    ['wang', '/teacher/aftersales', '售后跟进'],
    ['parent1', '/parent/children/1?plan=1', '学生体型信息'],
    ['parent1', '/parent/children/1?plan=1', '换码'],
    ['parent3', '/parent/children/3?plan=1', '立即缴费'],
    ['supplier1', '/supplier/batches/1', '创建发货单'],
    ['service1', '/service/tickets/1', 'AS2026-0001'],
    ['admin', '/orders/1', '订单 U2026-0001'],
    ['admin', '/orders/1', '订单时间线'],
    ['parent1', '/notifications', '通知中心'],
  ];
  for (const [u, path, marker] of checks) {
    const page = await get(path, cookies[u]);
    check(`${u} ${path} 包含「${marker}」`, page.status === 200 && page.text.includes(marker), `status=${page.status}`);
  }

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
