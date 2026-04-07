import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withTokenRefresh, type GoogleCredentials } from '@/lib/storage/token-refresh';
import { decryptToken } from '@/lib/crypto/tokens';
import { drive as createDrive } from '@googleapis/drive';
import { PostgresMsalCachePlugin } from '@/lib/storage/msal-cache-plugin';
import { ConfidentialClientApplication, InteractionRequiredAuthError } from '@azure/msal-node';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// App Router: force dynamic — reads portal token from URL params
export const dynamic = 'force-dynamic';

interface UploadSessionBody {
  filename: string;
  mimeType: string;
  fileSize: number;
  clientName?: string;
  filingTypeId?: string;
  taxYear?: string;
}

/**
 * POST /api/portal/[token]/upload-session
 *
 * Called by the browser when file.size > 4 MB (LARGE_FILE_THRESHOLD in portal-checklist.tsx).
 * Authenticates the portal token, resolves the org's storage backend, then initiates
 * a provider-native upload session.
 *
 * Returns:
 *   { sessionUrl: string | null, sessionId: string | null, provider: string, storagePath: string | null }
 *
 * Provider behaviour:
 *   - google_drive:  returns pre-authenticated resumable sessionUrl for direct browser PUT
 *   - onedrive:      returns uploadUrl from Graph createUploadSession
 *   - dropbox:       returns { sessionId: 'PROXY', provider: 'dropbox' } — no pre-auth URL available
 *   - supabase:      returns { provider: 'supabase' } — browser falls back to existing upload route
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const supabase = createServiceClient();

  // ── 1. Validate portal token ─────────────────────────────────────────────────
  const { data: portalToken } = await supabase
    .from('upload_portal_tokens')
    .select(
      'id, org_id, client_id, filing_type_id, tax_year, expires_at, revoked_at, organisations!inner(storage_backend, google_drive_folder_id, ms_home_account_id), clients!inner(company_name, display_name)'
    )
    .eq('token_hash', tokenHash)
    .single();

  if (
    !portalToken ||
    portalToken.revoked_at ||
    new Date(portalToken.expires_at) < new Date()
  ) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 });
  }

  // ── 2. Resolve org storage config (FK join or fallback queries) ───────────────
  let orgStorageBackend: string | null = null;
  let orgGoogleDriveFolderId: string | null = null;
  let orgMsHomeAccountId: string | null = null;

  const orgJoin = (portalToken.organisations as unknown) as {
    storage_backend: string | null;
    google_drive_folder_id: string | null;
    ms_home_account_id: string | null;
  } | null;

  if (orgJoin) {
    orgStorageBackend = orgJoin.storage_backend;
    orgGoogleDriveFolderId = orgJoin.google_drive_folder_id;
    orgMsHomeAccountId = orgJoin.ms_home_account_id;
  } else {
    // FK join cache miss (PGRST200) — fall back to separate query
    const orgResult = await supabase
      .from('organisations')
      .select('storage_backend, google_drive_folder_id, ms_home_account_id')
      .eq('id', portalToken.org_id)
      .single();
    orgStorageBackend = orgResult.data?.storage_backend ?? null;
    orgGoogleDriveFolderId = orgResult.data?.google_drive_folder_id ?? null;
    orgMsHomeAccountId = orgResult.data?.ms_home_account_id ?? null;
  }

  // ── 3. Parse request body ────────────────────────────────────────────────────
  let body: UploadSessionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { filename, mimeType, fileSize } = body;

  if (!filename || !mimeType || !fileSize) {
    return NextResponse.json(
      { error: 'filename, mimeType, and fileSize are required' },
      { status: 400 }
    );
  }

  // ── 4. Branch on storage backend ─────────────────────────────────────────────

  // Supabase: no chunked session needed — browser should use existing upload route
  if (!orgStorageBackend || orgStorageBackend === 'supabase') {
    return NextResponse.json({ sessionUrl: null, sessionId: null, provider: 'supabase' });
  }

  // ── Google Drive ─────────────────────────────────────────────────────────────
  if (orgStorageBackend === 'google_drive') {
    if (!orgGoogleDriveFolderId) {
      return NextResponse.json(
        { error: 'Google Drive folder not configured for this org' },
        { status: 500 }
      );
    }

    // Fetch encrypted credentials from organisations
    const { data: orgData, error: orgError } = await supabase
      .from('organisations')
      .select('google_access_token_enc, google_refresh_token_enc, google_token_expires_at')
      .eq('id', portalToken.org_id)
      .single();

    if (orgError || !orgData?.google_access_token_enc) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 500 }
      );
    }

    const creds: GoogleCredentials = {
      access_token_enc: orgData.google_access_token_enc,
      refresh_token_enc: orgData.google_refresh_token_enc ?? '',
      expires_at: orgData.google_token_expires_at ?? new Date(0).toISOString(),
      org_id: portalToken.org_id,
    };

    // Resolve client display name for folder hierarchy
    const clientJoin = (portalToken.clients as unknown) as {
      company_name: string | null;
      display_name: string | null;
    } | null;
    let clientName: string = portalToken.client_id;
    if (clientJoin) {
      clientName = clientJoin.display_name ?? clientJoin.company_name ?? portalToken.client_id;
    } else {
      const clientResult = await supabase
        .from('clients')
        .select('display_name, company_name')
        .eq('id', portalToken.client_id)
        .single();
      clientName =
        clientResult.data?.display_name ??
        clientResult.data?.company_name ??
        portalToken.client_id;
    }

    const taxYear = portalToken.tax_year ?? String(new Date().getFullYear());
    const filingTypeId = portalToken.filing_type_id;
    const rootFolderId = orgGoogleDriveFolderId;

    try {
      // Use withTokenRefresh to get a valid OAuth2Client, then build folder hierarchy
      // and initiate a resumable upload session
      const sessionUrl = await withTokenRefresh(creds, async (oauth2Client) => {
        const drive = createDrive({ version: 'v3', auth: oauth2Client });

        // Re-implement findOrCreateFolder inline (private method in GoogleDriveProvider)
        const findOrCreateFolder = async (parentId: string, name: string): Promise<string> => {
          const escapedName = name.replace(/'/g, "\\'");
          const listResponse = await drive.files.list({
            q: `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
            spaces: 'drive',
          });
          const existingFiles = listResponse.data.files ?? [];
          if (existingFiles.length > 0 && existingFiles[0].id) {
            return existingFiles[0].id;
          }
          const createResponse = await drive.files.create({
            requestBody: {
              name,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [parentId],
            },
            fields: 'id',
          });
          if (!createResponse.data.id) {
            throw new Error(`Failed to create Drive folder: ${name}`);
          }
          return createResponse.data.id;
        };

        // Build folder hierarchy: root → clientName → filingTypeId → taxYear
        const clientFolderId = await findOrCreateFolder(rootFolderId, clientName);
        const filingTypeFolderId = await findOrCreateFolder(clientFolderId, filingTypeId);
        const taxYearFolderId = await findOrCreateFolder(filingTypeFolderId, taxYear);

        // Get a current access token from the (already-configured) OAuth2Client
        const accessToken = (await oauth2Client.getAccessToken()).token;
        if (!accessToken) {
          throw new Error('Failed to obtain Google access token for resumable session');
        }

        // Initiate a resumable upload session directly via the Google Drive upload API
        // This returns a Location header containing the session URL — pre-authenticated
        const initResponse = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'X-Upload-Content-Type': mimeType,
              'X-Upload-Content-Length': String(fileSize),
            },
            body: JSON.stringify({
              name: filename,
              parents: [taxYearFolderId],
            }),
          }
        );

        if (!initResponse.ok) {
          const errorText = await initResponse.text();
          throw new Error(
            `Drive resumable session initiation failed (${initResponse.status}): ${errorText}`
          );
        }

        const location = initResponse.headers.get('Location');
        if (!location) {
          throw new Error('Drive resumable session did not return a Location header');
        }

        return location;
      });

      return NextResponse.json({
        sessionUrl,
        sessionId: null,
        provider: 'google_drive',
        storagePath: null,
      });
    } catch (err) {
      logger.error('[upload-session] Google Drive session initiation error:', { error: (err as any)?.message ?? String(err) });
      return NextResponse.json(
        { error: 'Failed to initiate Google Drive upload session' },
        { status: 500 }
      );
    }
  }

  // ── OneDrive ─────────────────────────────────────────────────────────────────
  if (orgStorageBackend === 'onedrive') {
    if (!orgMsHomeAccountId) {
      return NextResponse.json(
        { error: 'OneDrive not connected for this org' },
        { status: 500 }
      );
    }

    // Acquire access token via MSAL (PostgresMsalCachePlugin loads from Postgres)
    const msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.MS_CLIENT_ID!,
        authority: 'https://login.microsoftonline.com/common',
        clientSecret: process.env.MS_CLIENT_SECRET!,
      },
      cache: {
        cachePlugin: new PostgresMsalCachePlugin(portalToken.org_id),
      },
    });

    const tokenCache = msalClient.getTokenCache();
    const account = await tokenCache.getAccountByHomeId(orgMsHomeAccountId);

    if (!account) {
      return NextResponse.json(
        { error: 'OneDrive session not found — reconnection required' },
        { status: 500 }
      );
    }

    let accessToken: string;
    try {
      const result = await msalClient.acquireTokenSilent({
        account,
        scopes: ['Files.ReadWrite', 'offline_access'],
      });
      accessToken = result.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        return NextResponse.json(
          { error: 'OneDrive re-authentication required' },
          { status: 500 }
        );
      }
      logger.error('[upload-session] OneDrive token acquisition error:', { error: (err as any)?.message ?? String(err) });
      return NextResponse.json(
        { error: 'Failed to acquire OneDrive access token' },
        { status: 500 }
      );
    }

    // Resolve client name for path construction
    const clientJoin2 = (portalToken.clients as unknown) as {
      company_name: string | null;
      display_name: string | null;
    } | null;
    let clientName2: string = portalToken.client_id;
    if (clientJoin2) {
      clientName2 =
        clientJoin2.display_name ?? clientJoin2.company_name ?? portalToken.client_id;
    } else {
      const clientResult2 = await supabase
        .from('clients')
        .select('display_name, company_name')
        .eq('id', portalToken.client_id)
        .single();
      clientName2 =
        clientResult2.data?.display_name ??
        clientResult2.data?.company_name ??
        portalToken.client_id;
    }

    const taxYear2 = portalToken.tax_year ?? String(new Date().getFullYear());
    const filingTypeId2 = portalToken.filing_type_id;

    // Build the encoded path: Apps/Prompt/{clientName}/{filingTypeId}/{taxYear}/{filename}
    const encodedPath = [
      encodeURIComponent(clientName2),
      encodeURIComponent(filingTypeId2),
      encodeURIComponent(taxYear2),
      encodeURIComponent(filename),
    ].join('/');

    const createSessionUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/Apps/Prompt/${encodedPath}:/createUploadSession`;

    try {
      const sessionResponse = await fetch(createSessionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'rename' },
        }),
      });

      if (!sessionResponse.ok) {
        const errorText = await sessionResponse.text();
        throw new Error(
          `OneDrive createUploadSession failed (${sessionResponse.status}): ${errorText}`
        );
      }

      const sessionData = await sessionResponse.json();
      const uploadUrl = sessionData.uploadUrl;

      if (!uploadUrl) {
        throw new Error('OneDrive createUploadSession did not return uploadUrl');
      }

      return NextResponse.json({
        sessionUrl: uploadUrl,
        sessionId: null,
        provider: 'onedrive',
        storagePath: null,
      });
    } catch (err) {
      logger.error('[upload-session] OneDrive session initiation error:', { error: (err as any)?.message ?? String(err) });
      return NextResponse.json(
        { error: 'Failed to initiate OneDrive upload session' },
        { status: 500 }
      );
    }
  }

  // ── Dropbox ───────────────────────────────────────────────────────────────────
  if (orgStorageBackend === 'dropbox') {
    // Dropbox has no pre-authenticated session URL — signal browser to use proxy path.
    // The PROXY marker tells portal-checklist.tsx to fall through to the existing upload route.
    return NextResponse.json({
      sessionUrl: null,
      sessionId: 'PROXY',
      provider: 'dropbox',
      storagePath: null,
    });
  }

  // Unknown backend — fall back to supabase path
  return NextResponse.json({ sessionUrl: null, sessionId: null, provider: 'supabase' });
}
