'use client';
import { useDocumentNotifications } from '@/lib/documents/use-document-notifications';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

/**
 * Mounts the Realtime document notification subscription in the dashboard layout.
 * Resolves orgId from the authenticated user's JWT app_metadata.
 * Renders nothing — purely a side-effect component.
 */
export function DocumentNotificationMount() {
  const [orgId, setOrgId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const oid = user?.app_metadata?.org_id as string | undefined;
      setOrgId(oid);
    });
  }, []);

  useDocumentNotifications(orgId);
  return null; // renders nothing — side-effect component only
}
