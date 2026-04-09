// Shared types and constants for settings — NOT a "use server" file
// so it can export types, interfaces, and non-async functions safely.

export interface EmailSettings {
  senderName: string;
  senderAddress: string;
  replyTo: string;
}

export const EMAIL_DEFAULTS: EmailSettings = {
  senderName: "Prompt",
  senderAddress: "hello@prompt.accountants",
  replyTo: "hello@prompt.accountants",
};

export function getDefaultsForDomain(domain: string | null): EmailSettings {
  if (domain) {
    return {
      senderName: "Prompt",
      senderAddress: `hello@${domain}`,
      replyTo: `hello@${domain}`,
    };
  }
  return EMAIL_DEFAULTS;
}

export const EMAIL_KEYS = {
  senderName: "email_sender_name",
  senderAddress: "email_sender_address",
  replyTo: "email_reply_to",
} as const;

export type SetupMode = "demo" | "real";

export interface OrgDomainDnsData {
  domain: string;
  dkimPendingHost: string;
  dkimPendingValue: string;
  returnPathHost: string;
  returnPathCnameValue: string;
  dkimVerified: boolean;
  returnPathVerified: boolean;
}

export interface StorageInfo {
  storageBackend: string | null;
  googleDriveFolderId: string | null;
  storageBackendStatus: string | null;
  dropboxConnected: boolean;
}

export type UploadCheckMode = 'none' | 'verify' | 'extract' | 'both';
