'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import { IconButtonWithText } from '@/components/ui/icon-button-with-text';

interface DocumentType {
  code: string;
  label: string;
}

interface ClientDocument {
  id: string;
  filing_type_id: string;
  document_type_id: string | null;
  original_filename: string;
  received_at: string | null;
  classification_confidence: 'high' | 'medium' | 'low' | 'unclassified';
  source: 'portal_upload' | 'inbound_email' | 'manual';
  created_at: string;
  retention_flagged: boolean;
  document_types: DocumentType | null;
}

interface DocumentCardProps {
  clientId: string;
  filingTypeId: string;
  filingTypeName: string;
}

/**
 * Confidence badge uses the inline div+span pattern from DESIGN.md (not Badge component).
 * Traffic light colours for confidence levels (distinct from filing status colours).
 */
function ConfidenceBadge({ confidence }: { confidence: ClientDocument['classification_confidence'] }) {
  const config: Record<
    ClientDocument['classification_confidence'],
    { bg: string; text: string; label: string }
  > = {
    high: { bg: 'bg-green-500/10', text: 'text-green-600', label: 'High' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Medium' },
    low: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Low' },
    unclassified: { bg: 'bg-neutral-500/10', text: 'text-neutral-500', label: 'Unclassified' },
  };

  const { bg, text, label } = config[confidence] ?? config.unclassified;

  return (
    <div className={`px-2 py-0.5 rounded-md inline-flex items-center ${bg}`}>
      <span className={`text-xs font-medium ${text}`}>{label}</span>
    </div>
  );
}

function formatSource(source: ClientDocument['source']): string {
  if (source === 'portal_upload') return 'Portal';
  if (source === 'inbound_email') return 'Email';
  return 'Manual';
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DocumentCard({ clientId, filingTypeId, filingTypeName }: DocumentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/documents`)
      .then((r) => r.json())
      .then(({ documents: docs }: { documents: ClientDocument[] }) => {
        // Filter to documents for this filing type
        const filtered = (docs ?? []).filter((d) => d.filing_type_id === filingTypeId);
        setDocuments(filtered);
      })
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [clientId, filingTypeId]);

  const mostRecent = documents[0];
  const docCount = documents.length;

  const handleDownload = async (documentId: string) => {
    setDownloading(documentId);
    try {
      const res = await fetch(`/api/clients/${clientId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', documentId }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Download failed:', err.error);
        return;
      }
      const { signedUrl } = await res.json() as { signedUrl: string };
      window.open(signedUrl, '_blank');
    } catch (e) {
      console.error('Download error:', e);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card className="gap-0">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold">{filingTypeName}</span>
          {loading ? (
            <span className="text-xs text-muted-foreground">Loading...</span>
          ) : (
            <>
              <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-neutral-500/10">
                <span className="text-xs font-medium text-neutral-600">
                  {docCount} {docCount === 1 ? 'document' : 'documents'}
                </span>
              </div>
              {mostRecent && (
                <span className="text-xs text-muted-foreground">
                  Last: {formatDate(mostRecent.received_at ?? mostRecent.created_at)}
                </span>
              )}
            </>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <CardContent className="px-5 pb-4 pt-0">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No documents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Filename</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Type</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Confidence</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Received</th>
                    <th className="text-left text-xs font-medium text-muted-foreground py-2 pr-4">Source</th>
                    <th className="text-right text-xs font-medium text-muted-foreground py-2">Download</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4">
                        <span className="text-xs font-mono truncate max-w-[200px] block">
                          {doc.original_filename}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs text-muted-foreground">
                          {doc.document_types?.label ?? '—'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <ConfidenceBadge confidence={doc.classification_confidence} />
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.received_at ?? doc.created_at)}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-xs text-muted-foreground">
                          {formatSource(doc.source)}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <IconButtonWithText
                          variant="blue"
                          onClick={() => handleDownload(doc.id)}
                          disabled={downloading === doc.id}
                        >
                          <Download className="size-3" />
                          {downloading === doc.id ? 'Opening...' : 'Download'}
                        </IconButtonWithText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
