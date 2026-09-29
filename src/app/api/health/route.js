import { NextResponse } from 'next/server';

// GET /api/health  容器健康检查
export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
