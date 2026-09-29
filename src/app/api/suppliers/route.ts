import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { api, ok } from '@/lib/api';

export const GET = api(async (req: NextRequest) => {
  const rows = await query('SELECT * FROM suppliers ORDER BY id');
  return ok({ suppliers: rows });
});

export const POST = api(async (_req: NextRequest, body: any) => {
  const r = await query('INSERT INTO suppliers (name, contact) VALUES (?,?)', [body.name, body.contact || null]);
  return ok({ id: (r as any).insertId });
}, ['admin', 'general_affairs']);
