import Link from 'next/link';
import { requireUser } from '../../../../lib/session';
import { q } from '../../../../lib/db';
import { createCampus, createGrade, createClass, createUser, createStudent, togglePoverty, markTransferred } from '../../../../lib/actions/admin';
import { L, label } from '../../../../lib/util';
import { Badge, Msg } from '../../../../components/ui';

export default async function BaseDataPage({ searchParams }) {
  await requireUser(['ADMIN']);
  const campuses = await q('SELECT * FROM campuses ORDER BY id');
  const grades = await q(
    'SELECT g.*, c.name AS campus_name FROM grades g JOIN campuses c ON c.id=g.campus_id ORDER BY g.id');
  const classes = await q(
    `SELECT c.*, g.name AS grade_name, cp.name AS campus_name, u.name AS teacher_name,
       (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id) AS students
     FROM classes c JOIN grades g ON g.id=c.grade_id JOIN campuses cp ON cp.id=g.campus_id
     LEFT JOIN users u ON u.id=c.teacher_id ORDER BY c.id`);
  const teachers = await q('SELECT id, name FROM users WHERE role=\'TEACHER\' ORDER BY id');
  const suppliers = await q('SELECT * FROM suppliers ORDER BY id');
  const students = await q(
    `SELECT s.*, c.name AS class_name, u.name AS parent_name
     FROM students s JOIN classes c ON c.id=s.class_id LEFT JOIN users u ON u.id=s.parent_id
     ORDER BY s.id DESC LIMIT 50`);
  const users = await q('SELECT * FROM users ORDER BY id DESC LIMIT 30');

  return (
    <>
      <div className="page-title">基础数据维护</div>
      <Msg searchParams={searchParams} />

      <div className="grid cols-2">
        <div className="card">
          <h3>校区（{campuses.length}）</h3>
          <div className="small mb">{campuses.map((c) => c.name).join('、') || '暂无'}</div>
          <form action={createCampus} className="flex">
            <input name="name" placeholder="新校区名称" required style={{ flex: 1, padding: '6px 9px' }} />
            <button className="btn sm">添加</button>
          </form>
        </div>
        <div className="card">
          <h3>年级（{grades.length}）</h3>
          <div className="small mb">
            {grades.map((g) => `${g.campus_name}·${g.name}${g.is_graduating ? '(毕业班)' : ''}`).join('、') || '暂无'}
          </div>
          <form action={createGrade} className="flex">
            <select name="campus_id">{campuses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input name="name" placeholder="年级名称" required style={{ width: 110, padding: '6px 9px' }} />
            <label className="small"><input type="checkbox" name="is_graduating" /> 毕业班</label>
            <button className="btn sm">添加</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3>班级（{classes.length}）</h3>
        <div className="tbl-wrap mb">
          <table className="tbl">
            <thead><tr><th>校区</th><th>年级</th><th>班级</th><th>班主任</th><th>学生数</th></tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.campus_name}</td><td>{c.grade_name}</td><td>{c.name}</td>
                  <td>{c.teacher_name || <span className="muted">未指定</span>}</td><td>{c.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createClass} className="flex">
          <select name="grade_id">{grades.map((g) => <option key={g.id} value={g.id}>{g.campus_name}·{g.name}</option>)}</select>
          <input name="name" placeholder="班级名称" required style={{ width: 130, padding: '6px 9px' }} />
          <select name="teacher_id">
            <option value="">班主任（可选）</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn sm">添加班级</button>
        </form>
      </div>

      <div className="card">
        <h3>学生建档（最近 50 条）</h3>
        <div className="tbl-wrap mb">
          <table className="tbl">
            <thead><tr><th>学号</th><th>姓名</th><th>班级</th><th>家长账号</th><th>贫困生</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.student_no}</td>
                  <td>{s.name}</td>
                  <td className="small">{s.class_name}</td>
                  <td className="small">{s.parent_name || '—'}</td>
                  <td>
                    <form action={togglePoverty} className="inline">
                      <input type="hidden" name="student_id" value={s.id} />
                      <input type="hidden" name="redirect_to" value="/admin/base" />
                      <button className={`btn sm ${s.is_poverty ? '' : 'ghost'}`}>{s.is_poverty ? '贫困生 ✓' : '标记贫困生'}</button>
                    </form>
                  </td>
                  <td><Badge text={label(L.studentStatus, s.status)} /></td>
                  <td>
                    {s.status === 'ACTIVE' && (
                      <form action={markTransferred} className="inline">
                        <input type="hidden" name="student_id" value={s.id} />
                        <input type="hidden" name="redirect_to" value="/admin/base" />
                        <button className="btn sm gray">办理转学</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createStudent}>
          <div className="form-grid">
            <div className="field"><label>学号</label><input name="student_no" required placeholder="如 S2026016" /></div>
            <div className="field"><label>姓名</label><input name="name" required /></div>
            <div className="field">
              <label>性别</label>
              <select name="gender"><option>男</option><option>女</option></select>
            </div>
            <div className="field">
              <label>班级</label>
              <select name="class_id">{classes.map((c) => <option key={c.id} value={c.id}>{c.campus_name}·{c.name}</option>)}</select>
            </div>
            <div className="field"><label>家长账号（不存在则自动创建）</label><input name="parent_username" placeholder="如 parent14" /></div>
            <div className="field"><label>家长姓名</label><input name="parent_name" placeholder="自动创建账号时使用" /></div>
            <div className="field">
              <label>贫困生</label>
              <label className="flex small" style={{ marginTop: 8 }}><input type="checkbox" name="is_poverty" style={{ width: 'auto' }} /> 贫困生（缴费自动减免）</label>
            </div>
          </div>
          <div className="mt"><button className="btn sm">建档</button></div>
        </form>
      </div>

      <div className="card">
        <h3>账号管理（最近 30 个）</h3>
        <div className="tbl-wrap mb">
          <table className="tbl">
            <thead><tr><th>账号</th><th>姓名</th><th>角色</th><th>供应商</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.name}</td>
                  <td><Badge text={label(L.role, u.role)} tone="info" /></td>
                  <td className="small">{suppliers.find((s) => s.id === u.supplier_id)?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createUser}>
          <div className="form-grid">
            <div className="field"><label>账号</label><input name="username" required /></div>
            <div className="field"><label>姓名</label><input name="name" required /></div>
            <div className="field">
              <label>角色</label>
              <select name="role">{Object.entries(L.role).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div className="field"><label>初始密码</label><input name="password" placeholder="默认 123456" /></div>
            <div className="field">
              <label>所属供应商（供应商账号）</label>
              <select name="supplier_id"><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </div>
            <div className="field"><label>电话</label><input name="phone" /></div>
          </div>
          <div className="mt"><button className="btn sm">创建账号</button></div>
        </form>
      </div>
    </>
  );
}
