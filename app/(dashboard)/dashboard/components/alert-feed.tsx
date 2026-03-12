'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface DocumentActivity {
  id: string;
  client_id: string;
  original_filename: string;
  source: 'portal_upload' | 'inbound_email' | 'manual';
  created_at: string;
  document_types: { label: string } | null;
  clients: { company_name: string | null; display_name: string | null } | null;
}

export function AlertFeed() {
  const [activities, setActivities] = useState<DocumentActivity[]>([]);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('client_documents')
      .select(
        'id, client_id, original_filename, source, created_at, document_types(label), clients(company_name, display_name)'
      )
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setActivities((data as unknown as DocumentActivity[]) ?? []));
  }, []);

  const formatTime = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getClientName = (a: DocumentActivity) =>
    a.clients?.display_name || a.clients?.company_name || 'Unknown client';

  return (
    <Card
      className="group py-5 hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={() => router.push('/activity?tab=uploads&sort=received-desc')}
    >
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Documents
            </p>
          </div>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
            <Bell className="size-6 text-blue-500" />
          </div>
        </div>
        <div className="-mx-5">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-5">
              No document activity yet.
            </p>
          ) : (
            <div className="space-y-0">
              {activities.map((a) => (
                <Link
                  key={a.id}
                  href={`/clients/${a.client_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors border-t first:border-t-0"
                >
                  {/* Left: Client name */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="font-medium text-sm truncate">
                      {getClientName(a)}
                    </span>
                  </div>

                  {/* Right: Document type badge + divider + time */}
                  <div className="flex items-center gap-2 shrink-0">
                    {(a.document_types?.label ?? a.original_filename) && (
                      <div className="px-3 py-2 rounded-md inline-flex items-center bg-sky-500/10">
                        <span className="text-sm font-medium text-sky-500">
                          {a.document_types?.label ?? a.original_filename}
                        </span>
                      </div>
                    )}
                    <div className="h-4 border-r border-gray-300 dark:border-gray-700" />
                    <span className="text-sm text-muted-foreground">
                      {formatTime(a.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
