import { requireUser } from '../../../lib/session';
import { q } from '../../../lib/db';
import { fmtDT } from '../../../lib/util';
import { markAllRead } from '../../../lib/actions/misc';
import { Msg } from '../../../components/ui';

export default async function NotificationsPage({ searchParams }) {
  const user = await requireUser();
  const list = await q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100', [user.id]);
  return (
    <>
      <div className="between">
        <div className="page-title">通知中心</div>
        <form action={markAllRead}><button className="btn ghost sm">全部标为已读</button></form>
      </div>
      <Msg searchParams={searchParams} />
      <div className="card">
        {list.length === 0 && <div className="muted">暂无通知</div>}
        <ul className="timeline">
          {list.map((n) => (
            <li key={n.id} style={n.is_read ? { opacity: 0.55 } : undefined}>
              <div className="t">{fmtDT(n.created_at)} {!n.is_read && <span className="badge warn">未读</span>}</div>
              <div><b>{n.title}</b></div>
              <div className="d">{n.content}</div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
