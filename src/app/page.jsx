import { redirect } from 'next/navigation';
import { getSession, ROLE_HOME } from '../lib/session';

export default async function Home() {
  const s = await getSession();
  if (!s) redirect('/login');
  redirect(ROLE_HOME[s.role] || '/login');
}
