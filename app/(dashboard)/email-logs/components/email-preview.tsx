// Simple component to render plain text email body
// Note: inbound_emails stores plain text in email_body field, not TipTap JSON
interface EmailPreviewProps {
  subject: string | null;
  body: string | null;
  from: string;
  receivedAt: string;
}

export function EmailPreview({ subject, body, from, receivedAt }: EmailPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Email metadata */}
      <div className="border-b pb-4 space-y-2">
        <div className="text-sm">
          <span className="font-medium text-muted-foreground">From:</span>{' '}
          <span className="text-foreground">{from}</span>
        </div>
        <div className="text-sm">
          <span className="font-medium text-muted-foreground">Received:</span>{' '}
          <span className="text-foreground">{new Date(receivedAt).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}</span>
        </div>
        {subject && (
          <div className="text-sm">
            <span className="font-medium text-muted-foreground">Subject:</span>{' '}
            <span className="text-foreground font-medium">{subject}</span>
          </div>
        )}
      </div>

      {/* Email body */}
      <div className="prose prose-sm max-w-none">
        {body ? (
          <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
            {body}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground italic">No email body</p>
        )}
      </div>
    </div>
  );
}
