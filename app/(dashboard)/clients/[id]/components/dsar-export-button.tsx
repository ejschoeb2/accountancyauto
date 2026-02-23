'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DsarExportButtonProps {
  clientId: string;
  clientName: string;
}

export function DsarExportButton({ clientId, clientName }: DsarExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/documents/dsar`);
      if (response.status === 404) {
        toast.error('No documents found for this client');
        return;
      }
      if (!response.ok) {
        toast.error('Export failed. Please try again.');
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsar-${clientName.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('DSAR export downloaded');
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
      {loading ? 'Preparing export...' : 'DSAR Export'}
    </Button>
  );
}
