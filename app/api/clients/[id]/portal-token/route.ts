import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getOrgContext } from '@/lib/auth/org-context';
import crypto from 'crypto';

// POST: generate portal link for a client + filing type. Token expiry: 7 days (per Phase 18 decision).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const { orgId } = await getOrgContext();
  const { filingTypeId, taxYear } = await request.json();

  if (!filingTypeId || !taxYear) {
    return NextResponse.json({ error: 'filingTypeId and taxYear are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify client belongs to this org
  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', orgId).single();
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  // Revoke existing non-revoked tokens for this client+filing+year combination
  await supabase.from('upload_portal_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('filing_type_id', filingTypeId)
    .eq('tax_year', taxYear)
    .is('revoked_at', null);

  // Generate new token (256-bit entropy, SHA-256 hash stored)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days per Phase 18 decision

  const { error } = await supabase.from('upload_portal_tokens').insert({
    org_id: orgId,
    client_id: clientId,
    filing_type_id: filingTypeId,
    tax_year: taxYear,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });

  // Build portal URL — subdomain-aware: use NEXT_PUBLIC_APP_URL base for now
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const portalUrl = `${appUrl}/portal/${rawToken}`;

  return NextResponse.json({ portalUrl, expiresAt: expiresAt.toISOString() });
}

// DELETE: revoke all active tokens for this client (admin action)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;
  const { orgId } = await getOrgContext();
  const supabase = createServiceClient();

  const { data: client } = await supabase.from('clients').select('id').eq('id', clientId).eq('org_id', orgId).single();
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  await supabase.from('upload_portal_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .is('revoked_at', null);

  return NextResponse.json({ success: true });
}
