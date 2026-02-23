'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Bell, Upload, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('client_documents')
      .select(
        'id, client_id, original_filename, source, created_at, document_types(label), clients(company_name, display_name)'
      )
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setActivities((data as unknown as DocumentActivity[]) ?? []));
  }, []);

  const getIcon = (source: DocumentActivity['source']) => {
    if (source === 'portal_upload') return <Upload className="size-4 text-violet-500" />;
    if (source === 'inbound_email') return <Mail className="size-4 text-blue-500" />;
    return <Bell className="size-4 text-emerald-500" />;
  };

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

  if (activities.length === 0) {
    return (
      <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
        <CardContent className="px-5 py-0">
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Documents
            </p>
            <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Bell className="size-6 text-blue-500" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">No document activity yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-5 py-0">
        <div className="flex items-start justify-between mb-6">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Recent Documents
          </p>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
            <Bell className="size-6 text-blue-500" />
          </div>
        </div>
        <div className="space-y-2">
          {activities.map((a) => (
            <Link
              key={a.id}
              href={`/clients/${a.client_id}`}
              className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="mt-0.5">{getIcon(a.source)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">
                  <span className="text-foreground">{getClientName(a)}</span>{' '}
                  <span className="text-muted-foreground">
                    uploaded {a.document_types?.label ?? a.original_filename}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{formatTime(a.created_at)}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
