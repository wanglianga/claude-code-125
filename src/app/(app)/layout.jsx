import Link from 'next/link';
import { requireUser } from '../../lib/session';
import { logout } from '../../lib/actions/auth';
import { q } from '../../lib/db';
import { L } from '../../lib/util';

const NAV = {
  ADMIN: [
    ['工作台', '/admin'],
    ['订购计划', '/admin/plans'],
    ['生产批次', '/admin/batches'],
    ['发放管理', '/admin/distributions'],
    ['售后工单', '/admin/aftersales'],
    ['供应商考核', '/admin/assessments'],
    ['基础数据', '/admin/base'],
  ],
  TEACHER: [
    ['班级总览', '/teacher'],
    ['试穿管理', '/teacher/fittings'],
    ['发放管理', '/teacher/distributions'],
    ['售后跟进', '/teacher/aftersales'],
  ],
  PARENT: [['我的孩子', '/parent']],
  SUPPLIER: [['供应商工作台', '/supplier']],
  FACTORY: [['工厂工作台', '/factory']],
  SERVICE: [['售后工作台', '/service']],
};

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const unread = await q('SELECT COUNT(*) AS c FROM notifications WHERE user_id=? AND is_read=0', [user.id]);
  return (
    <>
      <header className="topbar">
        <div className="brand">校服订购与售后平台</div>
        <nav>
          {(NAV[user.role] || []).map(([label, href]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
          <Link href="/notifications">通知{unread[0].c > 0 ? `(${unread[0].c})` : ''}</Link>
        </nav>
        <div className="who">
          <b>{user.name}</b> · {L.role[user.role] || user.role}
        </div>
        <form action={logout}>
          <button className="btn sm gray" type="submit">退出</button>
        </form>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
