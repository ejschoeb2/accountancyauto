'use client'; // This is a client-side hook
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

/**
 * Subscribes to Supabase Realtime INSERT events on client_documents for the current org.
 * Fires a Sonner toast notification when a new document is received (DASH-03).
 *
 * Note: Realtime RLS means only this org's events are received by authenticated users.
 * Requires client_documents to be in the supabase_realtime publication (done in 19-01 migration).
 *
 * @param orgId - The current organisation ID (from JWT app_metadata)
 */
export function useDocumentNotifications(orgId: string | undefined) {
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();

    const channel = supabase
      .channel('document-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_documents',
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          const newDoc = payload.new as {
            client_id: string;
            document_type_id: string | null;
            original_filename: string;
            source: string;
          };

          // Fetch client name and document type label for the toast
          const [clientResult, docTypeResult] = await Promise.all([
            supabase
              .from('clients')
              .select('company_name, display_name')
              .eq('id', newDoc.client_id)
              .single(),
            newDoc.document_type_id
              ? supabase
                  .from('document_types')
                  .select('label')
                  .eq('id', newDoc.document_type_id)
                  .single()
              : Promise.resolve({ data: null }),
          ]);

          const clientName =
            clientResult.data?.display_name ||
            clientResult.data?.company_name ||
            'A client';
          const docTypeLabel =
            (docTypeResult.data as { label?: string } | null)?.label ??
            newDoc.original_filename;

          const sourceLabel =
            newDoc.source === 'portal_upload'
              ? 'Via upload portal'
              : newDoc.source === 'manual'
                ? 'Uploaded by accountant'
                : 'Via email';

          toast.success(`${clientName} uploaded ${docTypeLabel}`, {
            description: sourceLabel,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);
}
