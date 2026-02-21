import { type NextRequest } from 'next/server';
import { type SupabaseClient } from '@supabase/supabase-js';

export interface OrgInfo {
  id: string;
  slug: string;
  name: string;
  subscription_status: string;
  trial_ends_at: string | null;
}

/**
 * Extract org slug from the request.
 *
 * In development (localhost): reads from ?org= query param
 * In production: extracts from subdomain ({slug}.app.phasetwo.uk)
 *
 * Returns null for:
 * - Reserved subdomains (www, app, api, admin, billing)
 * - Bare domain (app.phasetwo.uk with no slug)
 * - Invalid or missing slug
 */
export function getOrgSlug(request: NextRequest): string | null {
  const hostname = request.headers.get('host') || '';

  // Development mode: use ?org= query param
  if (
    process.env.NODE_ENV === 'development' &&
    (hostname.includes('localhost') || hostname.includes('127.0.0.1'))
  ) {
    return request.nextUrl.searchParams.get('org');
  }

  // Production mode: extract from subdomain
  const parts = hostname.split('.');

  // Bare domain or malformed (e.g., app.phasetwo.uk or phasetwo.uk)
  if (parts.length < 3) {
    return null;
  }

  const slug = parts[0];

  // Reserved subdomains
  const reserved = ['www', 'app', 'api', 'admin', 'billing'];
  if (reserved.includes(slug)) {
    return null;
  }

  return slug;
}

/**
 * Resolve org information from slug.
 *
 * Queries the organisations table for matching slug.
 * Returns null if org not found or query fails.
 */
export async function resolveOrgFromSlug(
  supabase: SupabaseClient,
  slug: string
): Promise<OrgInfo | null> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, slug, name, subscription_status, trial_ends_at')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
