'use server';

import { revalidatePath } from 'next/cache';
import { q } from '../db';
import { getSession } from '../session';
import { ok } from './_shared';

// 通知全部标记已读
export async function markAllRead() {
  const s = await getSession();
  if (s) {
    await q('UPDATE notifications SET is_read=1 WHERE user_id=?', [s.uid]);
  }
  revalidatePath('/');
  ok('/notifications', '已全部标记为已读');
}
