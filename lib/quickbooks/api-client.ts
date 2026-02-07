import QuickBooks from "node-quickbooks";
import { TokenManager } from "./token-manager";

/**
 * Get a configured QuickBooks API client with a valid token
 */
export async function getQuickBooksClient(): Promise<QuickBooks> {
  const tokenManager = new TokenManager();

  // Get valid token (refreshes if needed)
  const accessToken = await tokenManager.getValidToken();

  // Get realm_id from stored tokens
  const storedTokens = await tokenManager.getStoredTokens();

  if (!storedTokens) {
    throw new Error("No QuickBooks connection found. Please connect to QuickBooks.");
  }

  const qbo = new QuickBooks(
    process.env.QUICKBOOKS_CLIENT_ID!,
    process.env.QUICKBOOKS_CLIENT_SECRET!,
    accessToken,
    false, // no token secret for OAuth 2.0
    storedTokens.realm_id,
    process.env.QUICKBOOKS_ENVIRONMENT === "sandbox", // use sandbox
    true, // debug mode (disable in production)
    null, // minor version
    "2.0", // OAuth version
    storedTokens.refresh_token
  );

  return qbo;
}
