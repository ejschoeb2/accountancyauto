import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

interface AuditEntry {
  org_id: string;
  user_id?: string;
  action: 'create' | 'update' | 'delete' | 'bulk_create' | 'bulk_delete';
  table_name: string;
  row_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('audit_log').insert(entry);
    if (error) {
      logger.error('Failed to write audit log', { error: error.message, entry });
    }
  } catch (err) {
    // Audit logging should never break the main operation
    logger.error('Audit log write exception', { error: (err as any)?.message });
  }
}
