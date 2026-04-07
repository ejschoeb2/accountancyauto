import { NextRequest, NextResponse } from 'next/server';
import { ServerClient } from 'postmark';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/settings/validate-postmark
 * Validates a Postmark server token by calling the Postmark API
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate token by calling Postmark API
    try {
      const client = new ServerClient(token.trim());
      const server = await client.getServer();

      return NextResponse.json({
        valid: true,
        serverName: server.Name,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid Postmark token';
      return NextResponse.json(
        { valid: false, error: message },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Postmark validation error:', { error: (error as any)?.message ?? String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
