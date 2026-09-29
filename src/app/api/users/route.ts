import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { api, ok } from '@/lib/api';

// 用户目录（下拉选择班主任/家长/售后等）
export const GET = api(async (req: NextRequest) => {
  const role = req.nextUrl.searchParams.get('role');
  const rows = await query(
    `SELECT id, username, real_name, role, campus_id, supplier_id, phone FROM users
     ${role ? 'WHERE role=?' : ''} ORDER BY role, id`,
    role ? [role] : []);
  return ok({ users: rows });
});
