import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latency_ms?: number; error?: string }> = {};

  // Check database connectivity
  const dbStart = Date.now();
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('organisations').select('id').limit(1);
    if (error) throw error;
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err: any) {
    checks.database = { status: 'error', latency_ms: Date.now() - dbStart, error: 'Database unreachable' };
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');

  return NextResponse.json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  }, { status: allHealthy ? 200 : 503 });
}
