"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, CheckCircle2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import { getInboundCheckerMode, type InboundCheckerMode } from "@/app/actions/settings";

interface InboundEmail {
  id: string;
  client_id: string | null;
  filing_type_id: string | null;
  received_at: string;
  email_from: string;
  email_subject: string | null;
  email_body: string | null;
  read: boolean;
  records_received_detected: boolean;
  raw_postmark_data: any;
}

interface InboundEmailDetailModalProps {
  open: boolean;
  onClose: () => void;
  email: InboundEmail | null;
  emails: InboundEmail[];
  onNavigate?: (direction: "prev" | "next") => void;
  onMarkAsRead?: (emailId: string) => void;
  onUpdateRecordsReceived?: (emailId: string, clientId: string, filingTypeId: string) => void;
}

function EmailBodyPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap break-words">
      {content}
    </div>
  );
}

export function InboundEmailDetailModal({
  open,
  onClose,
  email,
  emails,
  onNavigate,
  onMarkAsRead,
  onUpdateRecordsReceived,
}: InboundEmailDetailModalProps) {
  const [checkerMode, setCheckerMode] = useState<InboundCheckerMode>("auto");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function loadMode() {
      const mode = await getInboundCheckerMode();
      setCheckerMode(mode);
    }
    loadMode();
  }, []);

  // Mark as read when opened
  useEffect(() => {
    if (email && !email.read && onMarkAsRead) {
      onMarkAsRead(email.id);
    }
  }, [email?.id]);

  const currentIndex = email ? emails.findIndex((e) => e.id === email.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < emails.length - 1;

  const handleApprove = async () => {
    if (!email || !email.client_id || !email.filing_type_id) return;

    setIsUpdating(true);
    try {
      await onUpdateRecordsReceived?.(email.id, email.client_id, email.filing_type_id);
      onClose();
    } catch (error) {
      console.error("Failed to update records received:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl">Inbound Email</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Received on {new Date(email.received_at).toLocaleString()}
              </p>
            </div>
            <IconButtonWithText
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
              Close
            </IconButtonWithText>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Left side - Email preview (2/3 width on lg screens) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Email header info */}
            <Card className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-10 rounded-lg bg-status-info/10 shrink-0">
                  <Mail className="size-5 text-status-info" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-muted-foreground">From:</span>
                    <span className="text-sm truncate">{email.email_from}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Subject:</span>
                    <span className="text-sm truncate">{email.email_subject || "(No subject)"}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Email body preview */}
            <Card className="p-0 overflow-hidden">
              <div className="border-b px-4 py-3 bg-muted/30">
                <h3 className="text-sm font-semibold">Email Content</h3>
              </div>
              <div className="p-4 max-h-[500px] overflow-y-auto">
                {email.email_body ? (
                  <EmailBodyPreview content={email.email_body} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">No email body content</p>
                )}
              </div>
            </Card>
          </div>

          {/* Right side - Status and actions (1/3 width on lg screens) */}
          <div className="space-y-4">
            {/* Detection status */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">Detection Status</h3>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {email.records_received_detected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600 font-medium">
                        Documents detected
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-status-neutral" />
                      <span className="text-sm text-status-neutral font-medium">
                        No documents detected
                      </span>
                    </>
                  )}
                </div>

                {email.records_received_detected && (
                  <>
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Client ID:</span>
                        <span className="font-mono">{email.client_id || "Not linked"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Filing Type:</span>
                        <span className="font-mono">{email.filing_type_id || "Unknown"}</span>
                      </div>
                    </div>

                    {checkerMode === "recommend" && email.client_id && email.filing_type_id && (
                      <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground mb-3">
                          Recommendation mode is enabled. Click below to manually approve updating this client&apos;s records received status.
                        </p>
                        <ButtonBase
                          onClick={handleApprove}
                          disabled={isUpdating}
                          buttonType="text-with-icon"
                          variant="green"
                          className="w-full"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {isUpdating ? "Updating..." : "Mark Records Received"}
                        </ButtonBase>
                      </div>
                    )}

                    {checkerMode === "auto" && (
                      <div className="border-t pt-3">
                        <Badge variant="outline" className="w-full justify-center bg-green-500/10 text-green-600 border-green-600/20">
                          Auto-updated
                        </Badge>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Read status */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Read Status</h3>
              <Badge variant={email.read ? "outline" : "default"}>
                {email.read ? "Read" : "Unread"}
              </Badge>
            </Card>

            {/* Navigation */}
            {(hasPrev || hasNext) && (
              <Card className="p-4">
                <h3 className="text-sm font-semibold mb-3">Navigation</h3>
                <div className="flex gap-2">
                  <ButtonBase
                    onClick={() => onNavigate?.("prev")}
                    disabled={!hasPrev}
                    buttonType="text-with-icon"
                    variant="violet"
                    className="flex-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => onNavigate?.("next")}
                    disabled={!hasNext}
                    buttonType="text-with-icon"
                    variant="violet"
                    className="flex-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </ButtonBase>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  {currentIndex + 1} of {emails.length}
                </p>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
