import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('client_type')

  const counts: Record<string, number> = {}
  for (const c of clients ?? []) {
    if (c.client_type) {
      counts[c.client_type] = (counts[c.client_type] ?? 0) + 1
    }
  }

  return NextResponse.json(counts)
}
