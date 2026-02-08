// Phase 2: Reminder Engine Database Types
// TypeScript interfaces mirroring the Phase 2 database schema

// ============================================================================
// Filing Types
// ============================================================================

// Filing type identifiers
export type FilingTypeId =
  | 'corporation_tax_payment'
  | 'ct600_filing'
  | 'companies_house'
  | 'vat_return'
  | 'self_assessment';

export interface FilingType {
  id: FilingTypeId;
  name: string;
  description: string | null;
  applicable_client_types: Array<'Limited Company' | 'Sole Trader' | 'Partnership' | 'LLP'>;
  created_at: string;
}


// ============================================================================
// Client Filing Assignments
// ============================================================================

export interface ClientFilingAssignment {
  id: string;
  client_id: string;
  filing_type_id: FilingTypeId;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// Client Deadline Overrides
// ============================================================================

export interface ClientDeadlineOverride {
  id: string;
  client_id: string;
  filing_type_id: FilingTypeId;
  override_date: string; // YYYY-MM-DD
  reason: string | null;
  created_at: string;
  updated_at: string;
}


// ============================================================================
// Bank Holidays Cache
// ============================================================================

export interface BankHoliday {
  id: number;
  holiday_date: string; // YYYY-MM-DD
  title: string;
  region: string;
  fetched_at: string;
}

// ============================================================================
// Reminder Queue
// ============================================================================

export type ReminderStatus = 'scheduled' | 'pending' | 'sent' | 'cancelled' | 'failed';

export interface ReminderQueueItem {
  id: string;
  client_id: string;
  filing_type_id: FilingTypeId;
  template_id: string | null;
  step_index: number;
  deadline_date: string; // YYYY-MM-DD
  send_date: string; // YYYY-MM-DD
  status: ReminderStatus;
  resolved_subject: string | null;
  resolved_body: string | null;
  html_body: string | null; // v1.1 rich HTML from renderTipTapEmail()
  queued_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// v1.1 Normalized Tables
// ============================================================================

export interface TipTapDocument {
  type: 'doc';
  content: TipTapNode[];
}

export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export type UrgencyLevel = 'normal' | 'high' | 'urgent';

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_json: TipTapDocument;
  body_plain: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: string;
  filing_type_id: FilingTypeId;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleStep {
  id: string;
  schedule_id: string;
  email_template_id: string;
  step_number: number;
  delay_days: number;
  urgency_level: UrgencyLevel;
  created_at: string;
}

export interface ClientEmailOverride {
  id: string;
  client_id: string;
  email_template_id: string;
  subject_override: string | null;
  body_json_override: TipTapDocument | null;
  created_at: string;
  updated_at: string;
}

export interface ClientScheduleOverride {
  id: string;
  client_id: string;
  schedule_step_id: string;
  delay_days_override: number | null;
  is_skipped: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Template Placeholder Variables
// ============================================================================

// Available placeholder variables for template editor reference
export const PLACEHOLDER_VARIABLES = [
  { name: 'client_name', description: "Client's company or trading name" },
  { name: 'deadline', description: 'Deadline date in long format (e.g., 31 January 2026)' },
  { name: 'deadline_short', description: 'Deadline date in short format (e.g., 31/01/2026)' },
  { name: 'filing_type', description: 'Type of filing (e.g., Corporation Tax Payment)' },
  { name: 'days_until_deadline', description: 'Number of days remaining until deadline' },
  { name: 'accountant_name', description: 'Practice name (Peninsula Accounting)' },
] as const;
