import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function generateUnsubscribeToken(clientId: string): string {
  return createHmac('sha256', process.env.CRON_SECRET!).update(clientId).digest('hex');
}

function verifyUnsubscribeToken(clientId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(clientId);
  // Use timingSafeEqual to prevent timing attacks
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(token, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * GET /api/unsubscribe?client_id=xxx&token=yyy
 * Unsubscribe a client from reminder emails (sets reminders_paused = true)
 * token is HMAC-SHA256(CRON_SECRET, client_id) — prevents IDOR
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const token = searchParams.get('token');

    if (!clientId || !token) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head><title>Invalid Link</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>Invalid Unsubscribe Link</h1>
  <p>This unsubscribe link is invalid or incomplete.</p>
</body>
</html>`,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    if (!verifyUnsubscribeToken(clientId, token)) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head><title>Invalid Link</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>Invalid Unsubscribe Link</h1>
  <p>This unsubscribe link is invalid or has expired. Please use the link from your original email.</p>
</body>
</html>`,
        {
          status: 403,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    const supabase = createServiceClient();

    // Check if client exists
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id, company_name, reminders_paused')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head><title>Client Not Found</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>Client Not Found</h1>
  <p>We couldn't find your account in our system.</p>
</body>
</html>`,
        {
          status: 404,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // Check if already unsubscribed
    if (client.reminders_paused) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head><title>Already Unsubscribed</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>✓ Already Unsubscribed</h1>
  <p>You are already unsubscribed from reminder emails.</p>
  <p style="color: #666; margin-top: 30px;">If you'd like to resubscribe, please contact us.</p>
</body>
</html>`,
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    // Pause reminders
    const { error: updateError } = await supabase
      .from('clients')
      .update({ reminders_paused: true })
      .eq('id', clientId);

    if (updateError) {
      throw new Error(`Failed to unsubscribe: ${updateError.message}`);
    }

    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head><title>Unsubscribed Successfully</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>✓ Unsubscribed Successfully</h1>
  <p>You have been unsubscribed from reminder emails.</p>
  <p style="color: #666; margin-top: 30px;">If you'd like to resubscribe in the future, please contact us.</p>
</body>
</html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  } catch (error) {
    logger.error('Unsubscribe error:', { error: (error as any)?.message ?? String(error) });
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 50px auto; text-align: center;">
  <h1>Something Went Wrong</h1>
  <p>We couldn't process your unsubscribe request. Please try again later or contact us directly.</p>
</body>
</html>`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

/**
 * POST /api/unsubscribe
 * One-click unsubscribe endpoint (List-Unsubscribe-Post)
 * Accepts client_id and token in the body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const clientId = params.get('client_id');
    const token = params.get('token');

    if (!clientId || !token) {
      return NextResponse.json({ error: 'Missing client_id or token' }, { status: 400 });
    }

    if (!verifyUnsubscribeToken(clientId, token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const supabase = createServiceClient();

    // Pause reminders
    const { error } = await supabase
      .from('clients')
      .update({ reminders_paused: true })
      .eq('id', clientId);

    if (error) {
      throw new Error(`Failed to unsubscribe: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('One-click unsubscribe error:', { error: (error as any)?.message ?? String(error) });
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}
