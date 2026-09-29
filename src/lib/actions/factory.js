'use server';

import { revalidatePath } from 'next/cache';
import { one, q, tx } from '../db';
import { getSession } from '../session';
import { logEvent, notify, notifyRole } from '../queries';
import { ok, fail, str, num } from './_shared';

async function requireFactory() {
  const s = await getSession();
  if (!s || s.role !== 'FACTORY') fail('/login', '请以工厂身份登录');
  return s;
}

// 工厂更新生产进度与预计到校时间
export async function updateBatchProgress(formData) {
  const s = await requireFactory();
  const batchId = num(formData.get('batch_id'));
  const batch = await one('SELECT * FROM production_batches WHERE id=?', [batchId]);
  if (!batch) fail('/factory', '批次不存在');
  const status = str(formData.get('status'), 20);
  if (!['IN_PRODUCTION', 'PRODUCED'].includes(status)) fail('/factory', '非法状态');
  const expected = str(formData.get('expected_arrival'), 20);
  await tx(async (conn) => {
    await conn.query(
      'UPDATE production_batches SET status=?, expected_arrival=COALESCE(?, expected_arrival) WHERE id=?',
      [status, expected || null, batchId]);
    await logEvent('BATCH', batchId, status === 'PRODUCED' ? 'PRODUCED' : 'IN_PRODUCTION',
      { id: s.uid, name: s.name },
      `批次 ${batch.batch_no} ${status === 'PRODUCED' ? '生产完成' : '开始生产'}${expected ? `，预计到校 ${expected}` : ''}`, conn);
    await notifyRole('ADMIN', '生产进度更新',
      `批次 ${batch.batch_no} ${status === 'PRODUCED' ? '已生产完成' : '已投产'}${expected ? `，预计到校 ${expected}` : ''}。`, conn);
    if (status === 'PRODUCED') {
      const suppliers = await q('SELECT id FROM users WHERE role=\'SUPPLIER\' AND supplier_id=?', [batch.supplier_id]);
      for (const u of suppliers) {
        await notify(u.id, '生产完成', `批次 ${batch.batch_no} 已生产完成，请安排分批发货。`, conn);
      }
    }
  });
  revalidatePath('/');
  ok('/factory', '生产进度已更新');
}
