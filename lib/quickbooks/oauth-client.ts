import OAuthClient from "intuit-oauth";
import { env } from "@/lib/validations/env";

let oauthClientInstance: OAuthClient | null = null;

export function getOAuthClient(): OAuthClient {
  if (oauthClientInstance) {
    return oauthClientInstance;
  }

  const environment =
    env.QUICKBOOKS_ENVIRONMENT === "production"
      ? OAuthClient.environment.production
      : OAuthClient.environment.sandbox;

  oauthClientInstance = new OAuthClient({
    clientId: env.QUICKBOOKS_CLIENT_ID,
    clientSecret: env.QUICKBOOKS_CLIENT_SECRET,
    environment,
    redirectUri: env.QUICKBOOKS_REDIRECT_URI,
  });

  return oauthClientInstance;
}

export function resetOAuthClient(): void {
  oauthClientInstance = null;
}
