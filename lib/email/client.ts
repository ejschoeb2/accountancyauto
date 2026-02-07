/**
 * Postmark email client singleton
 *
 * Requires POSTMARK_SERVER_TOKEN environment variable
 */

import { ServerClient } from 'postmark';

// Create singleton Postmark client
// POSTMARK_SERVER_TOKEN must be set in environment variables
export const postmarkClient = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);
