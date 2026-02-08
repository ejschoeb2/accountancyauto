/**
 * Postmark email client singleton
 *
 * Requires POSTMARK_SERVER_TOKEN environment variable.
 * Lazy-initialized to avoid crashing on module load when token is missing
 * (e.g. when server actions that only render previews import this module).
 */

import { ServerClient } from 'postmark';

let _client: ServerClient | null = null;

export function getPostmarkClient(): ServerClient {
  if (!_client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) {
      throw new Error('POSTMARK_SERVER_TOKEN environment variable is not set');
    }
    _client = new ServerClient(token);
  }
  return _client;
}

// Backwards-compatible export for existing code
// Uses a proxy so the client is only created when a method is actually called
export const postmarkClient = new Proxy({} as ServerClient, {
  get(_target, prop) {
    return (getPostmarkClient() as any)[prop];
  },
});
