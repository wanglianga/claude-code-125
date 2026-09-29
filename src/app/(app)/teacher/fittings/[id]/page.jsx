import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '../../../../../lib/session';
import { one, q } from '../../../../../lib/db';
import { saveFittingRecords } from '../../../../../lib/actions/teacher';
import { fmtDT, SIZE_OPTIONS, SHOE_OPTIONS } from '../../../../../lib/util';
import { Msg } from '../../../../../components/ui';

export default async function FittingSessionDetail({ params, searchParams }) {
  const user = await requireUser(['TEACHER']);
  const session = await one(
    `SELECT fs.*, p.title AS plan_title, c.name AS class_name FROM fitting_sessions fs
     JOIN order_plans p ON p.id=fs.plan_id JOIN classes c ON c.id=fs.class_id WHERE fs.id=?`, [params.id]);
  if (!session) redirect('/teacher/fittings');
  const students = await q(
    `SELECT s.*, m.height, m.weight, m.special_fit, m.special_note,
       fr.top_size, fr.pants_size, fr.skirt_size, fr.coat_size, fr.shoe_size, fr.note AS fr_note
     FROM students s
     LEFT JOIN measurements m ON m.student_id=s.id AND m.plan_id=?
     LEFT JOIN fitting_records fr ON fr.student_id=s.id AND fr.session_id=?
     WHERE s.class_id=? AND s.status='ACTIVE' ORDER BY s.student_no`,
    [session.plan_id, session.id, session.class_id]);

  const SizeSel = ({ name, value, shoes }) => (
    <>
      <input list={shoes ? 'shoe-opts' : 'size-opts'} name={name} defaultValue={value || ''} style={{ width: 64 }} />
    </>
  );

  return (
    <>
      <div className="between">
        <div className="page-title">试穿记录录入</div>
        <Link href="/teacher/fittings" className="btn ghost sm">返回</Link>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        <h3>{session.plan_title} · {session.class_name} <span className="sub">{fmtDT(session.slot_start)} @ {session.location || '待定'}</span></h3>
        <form action={saveFittingRecords}>
          <input type="hidden" name="session_id" value={session.id} />
          <input type="hidden" name="redirect_to" value={`/teacher/fittings/${session.id}`} />
          <datalist id="size-opts">{SIZE_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          <datalist id="shoe-opts">{SHOE_OPTIONS.map((s) => <option key={s} value={s} />)}</datalist>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>学生</th><th>身高/体重</th><th>特殊版型</th><th>上衣</th><th>裤子</th><th>裙装</th><th>外套</th><th>鞋码</th><th>备注</th></tr>
              </thead>
              <tbody>
                {students.map((stu) => (
                  <tr key={stu.id}>
                    <td className="nowrap"><b>{stu.name}</b><div className="small muted">{stu.student_no}</div></td>
                    <td className="small">{stu.height || '—'}cm / {stu.weight || '—'}kg</td>
                    <td className="small">{stu.special_fit ? <span className="badge warn">{stu.special_note || '特殊版型'}</span> : '—'}</td>
                    <td><SizeSel name={`top_${stu.id}`} value={stu.top_size} /></td>
                    <td><SizeSel name={`pants_${stu.id}`} value={stu.pants_size} /></td>
                    <td><SizeSel name={`skirt_${stu.id}`} value={stu.skirt_size} /></td>
                    <td><SizeSel name={`coat_${stu.id}`} value={stu.coat_size} /></td>
                    <td><SizeSel name={`shoe_${stu.id}`} value={stu.shoe_size} shoes /></td>
                    <td><input name={`note_${stu.id}`} defaultValue={stu.fr_note || ''} style={{ width: 120 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt"><button className="btn">保存全部记录并通知家长</button></div>
        </form>
      </div>
    </>
  );
}
