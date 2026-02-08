"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

import type { Client } from "@/app/actions/clients";
import { sendAdhocEmail, previewAdhocEmail } from "@/app/actions/send-adhoc-email";

type SendStep = 'select-template' | 'preview' | 'confirm' | 'sending' | 'results';

interface SendEmailModalProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_json: Record<string, any>;
}

interface SendResult {
  clientName: string;
  error: string;
}

export function SendEmailModal({ open, onClose, selectedClients }: SendEmailModalProps) {
  const [step, setStep] = useState<SendStep>('select-template');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failures, setFailures] = useState<SendResult[]>([]);

  // Calculate eligible clients (those with email addresses)
  const eligibleClients = selectedClients.filter(
    (client) => client.primary_email && client.primary_email.trim() !== ""
  );
  const skippedCount = selectedClients.length - eligibleClients.length;

  // Load templates when modal opens
  useEffect(() => {
    if (open && templates.length === 0) {
      setIsLoadingTemplates(true);
      fetch('/api/email-templates')
        .then((res) => res.json())
        .then((data) => {
          setTemplates(data);
          setIsLoadingTemplates(false);
        })
        .catch((error) => {
          console.error('Failed to load templates:', error);
          toast.error('Failed to load templates');
          setIsLoadingTemplates(false);
        });
    }
  }, [open, templates.length]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('select-template');
        setSelectedTemplateId("");
        setPreviewHtml("");
        setPreviewSubject("");
        setProgress(0);
        setSentCount(0);
        setFailures([]);
      }, 200); // Delay to allow close animation to complete
    }
  }, [open]);

  const handleNext = async () => {
    if (step === 'select-template') {
      // Load preview
      setIsLoadingPreview(true);
      setStep('preview');

      const firstClient = eligibleClients[0];
      const result = await previewAdhocEmail({
        templateId: selectedTemplateId,
        clientName: firstClient.display_name || firstClient.company_name,
      });

      setIsLoadingPreview(false);

      if ('error' in result) {
        toast.error(`Preview failed: ${result.error}`);
        setStep('select-template');
        return;
      }

      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
    } else if (step === 'preview') {
      setStep('confirm');
    }
  };

  const handleBack = () => {
    if (step === 'preview') {
      setStep('select-template');
    } else if (step === 'confirm') {
      setStep('preview');
    }
  };

  const handleSend = async () => {
    setStep('sending');
    setProgress(0);
    setSentCount(0);
    setFailures([]);

    for (const client of eligibleClients) {
      const result = await sendAdhocEmail({
        clientId: client.id,
        clientName: client.display_name || client.company_name,
        clientEmail: client.primary_email!,
        templateId: selectedTemplateId,
      });

      if (result.success) {
        setSentCount((prev) => prev + 1);
      } else {
        setFailures((prev) => [
          ...prev,
          {
            clientName: client.display_name || client.company_name,
            error: result.error || 'Unknown error',
          },
        ]);
      }

      setProgress((prev) => prev + 1);
    }

    setStep('results');
  };

  const handleClose = () => {
    if (step === 'results') {
      const totalSent = sentCount;
      const totalFailed = failures.length;

      if (totalFailed === 0) {
        toast.success(`Sent ${totalSent} email${totalSent !== 1 ? 's' : ''} successfully`);
      } else {
        toast.warning(
          `Sent ${totalSent} of ${eligibleClients.length} emails. ${totalFailed} failed.`
        );
      }
    }
    onClose();
  };

  const isNextDisabled =
    step === 'select-template' && (!selectedTemplateId || eligibleClients.length === 0);

  const preventClose = step === 'sending';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !preventClose && !isOpen && handleClose()}>
      <DialogContent
        onInteractOutside={(e) => preventClose && e.preventDefault()}
        onEscapeKeyDown={(e) => preventClose && e.preventDefault()}
        className="max-w-2xl"
      >
        {step === 'select-template' && (
          <>
            <DialogHeader>
              <DialogTitle>Send Email</DialogTitle>
              <DialogDescription>
                Select a template to send to {eligibleClients.length} client
                {eligibleClients.length !== 1 ? 's' : ''}
                {skippedCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-500">
                    {' '}
                    ({skippedCount} without email will be skipped)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {eligibleClients.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    None of the selected clients have email addresses.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email Template</label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingTemplates ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="size-4 animate-spin" />
                        </div>
                      ) : (
                        templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={isNextDisabled}>
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'preview' && (
          <>
            <DialogHeader>
              <DialogTitle>Preview Email</DialogTitle>
              <DialogDescription>
                Preview shown for {eligibleClients[0].display_name || eligibleClients[0].company_name}.
                Placeholders like client_name will be personalized for each recipient.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium mb-1">Subject:</p>
                    <p className="text-sm text-muted-foreground">{previewSubject}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Body:</p>
                    <div className="border rounded-lg overflow-hidden">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full h-[400px]"
                        title="Email Preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleNext}>Next</Button>
            </DialogFooter>
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Send</DialogTitle>
              <DialogDescription>
                Send to {eligibleClients.length} client{eligibleClients.length !== 1 ? 's' : ''}?
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Using template:{' '}
                <span className="font-medium text-foreground">
                  {templates.find((t) => t.id === selectedTemplateId)?.name}
                </span>
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleSend}>Send</Button>
            </DialogFooter>
          </>
        )}

        {step === 'sending' && (
          <>
            <DialogHeader>
              <DialogTitle>Sending Emails</DialogTitle>
              <DialogDescription>
                Please wait while emails are being sent...
              </DialogDescription>
            </DialogHeader>

            <div className="py-8 space-y-4">
              <Progress value={(progress / eligibleClients.length) * 100} />
              <p className="text-center text-sm text-muted-foreground">
                Sending... {progress}/{eligibleClients.length}
              </p>
            </div>
          </>
        )}

        {step === 'results' && (
          <>
            <DialogHeader>
              <DialogTitle>Send Complete</DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 p-4 text-center">
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {sentCount}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">Sent</p>
                </div>
                <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-4 text-center">
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {failures.length}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500">Failed</p>
                </div>
              </div>

              {failures.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Failed sends:</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 rounded-lg border p-3">
                    {failures.map((failure, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Badge variant="destructive" className="shrink-0">
                          {failure.clientName}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{failure.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
