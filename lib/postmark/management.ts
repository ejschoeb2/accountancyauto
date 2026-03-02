/**
 * Postmark Management (Account) API client.
 *
 * Uses the POSTMARK_ACCOUNT_TOKEN env var to create Postmark Servers and
 * Domains on behalf of new organisations during the setup wizard flow.
 *
 * All requests use the X-Postmark-Account-Token header.
 * Base URL: https://api.postmarkapp.com
 */

const POSTMARK_API_BASE = "https://api.postmarkapp.com";

function getAccountToken(): string {
  const token = process.env.POSTMARK_ACCOUNT_TOKEN;
  if (!token) {
    throw new Error("POSTMARK_ACCOUNT_TOKEN is not configured.");
  }
  return token;
}

function accountHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Postmark-Account-Token": getAccountToken(),
  };
}

// ─── createOrgServer ─────────────────────────────────────────────────────────

export interface CreateOrgServerResult {
  serverId: number;
  serverToken: string;
  inboundAddress: string;
}

/**
 * Create a Postmark Server for a new organisation.
 *
 * Configures inbound and delivery/bounce webhook URLs from NEXT_PUBLIC_APP_URL.
 */
function isPublicUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname !== "localhost" && !hostname.startsWith("127.") && !hostname.startsWith("192.168.");
  } catch {
    return false;
  }
}

export async function createOrgServer(
  orgName: string,
  orgSlug: string
): Promise<CreateOrgServerResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookSecret = process.env.POSTMARK_WEBHOOK_SECRET ?? "";

  // Postmark rejects non-public URLs (localhost, private IPs) with ErrorCode 606.
  // Only include webhook URLs when running against a real public deployment.
  const useWebhooks = isPublicUrl(appUrl);

  const serverName = `${orgName} (${orgSlug})`;

  const body: Record<string, unknown> = {
    Name: serverName,
    Color: "Blue",
    SmtpApiActivated: true,
  };

  if (useWebhooks) {
    body.InboundHookUrl = `${appUrl}/api/postmark/inbound?token=${webhookSecret}`;
    body.BounceHookUrl = `${appUrl}/api/webhooks/postmark`;
    body.DeliveryHookUrl = `${appUrl}/api/webhooks/postmark`;
  }

  const res = await fetch(`${POSTMARK_API_BASE}/servers`, {
    method: "POST",
    headers: accountHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();

    // ErrorCode 603: a server with this name already exists (e.g. created in a
    // previous attempt where the DB update failed, or the account was later cleared).
    // Treat it as idempotent — look up the existing server and return it.
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text); } catch { /* noop */ }

    if (parsed.ErrorCode === 603) {
      const existing = await findServerByName(serverName);
      if (existing) return existing;
    }

    throw new Error(`Postmark createServer failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    serverId: data.ID as number,
    serverToken: (data.ApiTokens as string[])[0],
    inboundAddress: data.InboundAddress as string,
  };
}

/**
 * Find an existing Postmark server by exact name and return its details.
 * Used as a fallback when creation fails with ErrorCode 603 (name already taken).
 */
async function findServerByName(name: string): Promise<CreateOrgServerResult | null> {
  const res = await fetch(`${POSTMARK_API_BASE}/servers?count=500&offset=0`, {
    headers: accountHeaders(),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const server = (data.Servers as Record<string, unknown>[] | undefined)
    ?.find((s) => s.Name === name);

  if (!server) return null;

  return {
    serverId: server.ID as number,
    serverToken: (server.ApiTokens as string[])[0],
    inboundAddress: server.InboundAddress as string,
  };
}

// ─── createOrgDomain ─────────────────────────────────────────────────────────

export interface CreateOrgDomainResult {
  domainId: number;
  dkimPendingHost: string;
  dkimPendingValue: string;
  returnPathHost: string;
  returnPathCnameValue: string;
}

/**
 * Create a Postmark Domain for the org's sending domain.
 *
 * Sets the ReturnPathDomain to `pm-bounces.{domain}` per Postmark convention.
 */
export async function createOrgDomain(
  domain: string
): Promise<CreateOrgDomainResult> {
  const body = {
    Name: domain,
    ReturnPathDomain: `pm-bounces.${domain}`,
  };

  const res = await fetch(`${POSTMARK_API_BASE}/domains`, {
    method: "POST",
    headers: accountHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();

    // ErrorCode 512: domain already exists (e.g. created in a previous attempt
    // where the DB update failed, or the account was later cleared while the
    // Postmark domain was left in place because it cannot be deleted via API).
    // Treat it as idempotent — look up the existing domain and return it.
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text); } catch { /* noop */ }

    if (parsed.ErrorCode === 512) {
      const existing = await findDomainByName(domain);
      if (existing) return existing;
    }

    throw new Error(`Postmark createDomain failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    domainId: data.ID as number,
    dkimPendingHost: data.DKIMPendingHost as string,
    dkimPendingValue: data.DKIMPendingValue as string,
    returnPathHost: `pm-bounces.${domain}`,
    returnPathCnameValue: (data.ReturnPathDomainCNAMEValue as string) ?? "pm.mtasv.net",
  };
}

/**
 * Find an existing Postmark domain by name and return its full DNS details.
 * Used as a fallback when creation fails with ErrorCode 512 (domain already exists).
 * Requires a second GET /domains/{id} call because the listing endpoint omits DKIM values.
 */
async function findDomainByName(domain: string): Promise<CreateOrgDomainResult | null> {
  // Step 1: list domains to find the ID
  const listRes = await fetch(`${POSTMARK_API_BASE}/domains?count=500&offset=0`, {
    headers: accountHeaders(),
  });
  if (!listRes.ok) return null;

  const listData = await listRes.json();
  const match = (listData.Domains as Record<string, unknown>[] | undefined)
    ?.find((d) => d.Name === domain);

  if (!match) return null;

  // Step 2: fetch full domain record for DKIM / return-path values
  const detailRes = await fetch(`${POSTMARK_API_BASE}/domains/${match.ID}`, {
    headers: accountHeaders(),
  });
  if (!detailRes.ok) return null;

  const d = await detailRes.json();

  return {
    domainId: d.ID as number,
    dkimPendingHost: (d.DKIMPendingHost ?? d.DKIMTextHost ?? "") as string,
    dkimPendingValue: (d.DKIMPendingValue ?? d.DKIMTextValue ?? "") as string,
    returnPathHost: `pm-bounces.${domain}`,
    returnPathCnameValue: (d.ReturnPathDomainCNAMEValue ?? "pm.mtasv.net") as string,
  };
}

// ─── checkDomainVerification ──────────────────────────────────────────────────

export interface DomainVerificationResult {
  dkimVerified: boolean;
  returnPathVerified: boolean;
}

/**
 * Check verification status of a Postmark domain.
 */
export async function checkDomainVerification(
  domainId: number
): Promise<DomainVerificationResult> {
  const res = await fetch(`${POSTMARK_API_BASE}/domains/${domainId}`, {
    method: "GET",
    headers: accountHeaders(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Postmark getDomain failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  return {
    dkimVerified: Boolean(data.DKIMVerified),
    returnPathVerified: Boolean(data.ReturnPathDomainVerified),
  };
}
