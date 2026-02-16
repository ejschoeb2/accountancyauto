"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Loader2, X, ArrowLeft, Eye, ArrowRight, Send, CheckCircle2, XCircle } from "lucide-react";

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
import { ButtonBase } from "@/components/ui/button-base";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateEditor } from "@/app/(dashboard)/templates/components/template-editor";
import { SubjectLineEditor } from "@/app/(dashboard)/templates/components/subject-line-editor";
import { PlaceholderDropdown } from "@/app/(dashboard)/templates/components/placeholder-dropdown";
import { EditorToolbar } from "@/app/(dashboard)/templates/components/template-editor-toolbar";

import type { Client } from "@/app/actions/clients";
import { sendAdhocEmail, previewAdhocEmail } from "@/app/actions/send-adhoc-email";
import { renderTipTapEmail } from "@/lib/email/render-tiptap";
import type { TipTapDocument } from "@/lib/types/database";

type SendStep = 'compose' | 'confirm' | 'sending' | 'results';

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
  const [step, setStep] = useState<SendStep>('compose');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("no-template");
  const [previewText, setPreviewText] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");
  const [editedSubject, setEditedSubject] = useState<string>("");
  const [editedHtml, setEditedHtml] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [failures, setFailures] = useState<SendResult[]>([]);

  // For email editing
  const [templateSubject, setTemplateSubject] = useState<string>("");
  const [templateBodyJson, setTemplateBodyJson] = useState<TipTapDocument | null>(null);
  const [isLoadingTemplateContent, setIsLoadingTemplateContent] = useState(false);
  const [editor, setEditor] = useState<any>(null);
  const templateSubjectInputRef = useRef<HTMLInputElement>(null);
  const templateEditorRef = useRef<{ insertPlaceholder: (id: string, label: string) => void; getEditor: () => any } | null>(null);

  // Update editor state when ref changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (templateEditorRef.current) {
        const ed = templateEditorRef.current.getEditor();
        if (ed && ed !== editor) {
          setEditor(ed);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editor]);

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

  // Update template content when selected template changes
  useEffect(() => {
    if (selectedTemplateId && selectedTemplateId !== "no-template" && templates.length > 0) {
      setIsLoadingTemplateContent(true);
      const template = templates.find((t) => t.id === selectedTemplateId);
      if (template) {
        // Brief delay to ensure editor fully unmounts and remounts
        setTimeout(() => {
          setTemplateSubject(template.subject);
          setTemplateBodyJson(template.body_json as TipTapDocument);
          setIsLoadingTemplateContent(false);
        }, 50);
      } else {
        setIsLoadingTemplateContent(false);
      }
    } else if (!selectedTemplateId || selectedTemplateId === "no-template") {
      // Clear content when "No template" is selected
      setIsLoadingTemplateContent(true);
      setTimeout(() => {
        setTemplateSubject("");
        setTemplateBodyJson(null);
        setIsLoadingTemplateContent(false);
      }, 50);
    }
  }, [selectedTemplateId, templates]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('compose');
        setSelectedTemplateId("no-template");
        setPreviewText("");
        setPreviewSubject("");
        setEditedText("");
        setEditedSubject("");
        setEditedHtml("");
        setTemplateSubject("");
        setTemplateBodyJson(null);
        setProgress(0);
        setSentCount(0);
        setFailures([]);
      }, 200); // Delay to allow close animation to complete
    }
  }, [open]);

  const handleNext = async () => {
    if (step === 'compose') {
      // Validate composition
      if (!templateSubject.trim()) {
        toast.error('Subject is required');
        return;
      }
      if (!templateBodyJson) {
        toast.error('Email body is required');
        return;
      }

      // Render the TipTap content to HTML and plain text for preview
      setIsLoadingPreview(true);
      setStep('confirm');
      const firstClient = eligibleClients[0];
      try {
        const rendered = await renderTipTapEmail({
          bodyJson: templateBodyJson,
          subject: templateSubject,
          context: {
            client_name: firstClient.display_name || firstClient.company_name,
            filing_type: 'Ad-hoc',
            deadline: new Date(),
            accountant_name: 'Peninsula Accounting',
          },
          clientId: firstClient.id,
        });

        setEditedSubject(rendered.subject);
        setEditedText(rendered.text);
        setEditedHtml(rendered.html);
      } catch (error) {
        toast.error('Failed to render email content');
        console.error(error);
        setStep('compose');
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('compose');
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
        templateId: (selectedTemplateId === "no-template" || !selectedTemplateId)
          ? '00000000-0000-0000-0000-000000000000' // Dummy ID for custom emails
          : selectedTemplateId,
        customSubject: editedSubject,
        customText: editedText,
        customHtml: editedHtml,
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
    (step === 'compose' && (!templateSubject.trim() || !templateBodyJson || eligibleClients.length === 0));

  const preventClose = step === 'sending';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !preventClose && !isOpen && handleClose()}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => preventClose && e.preventDefault()}
        onEscapeKeyDown={(e) => preventClose && e.preventDefault()}
        className="sm:max-w-6xl max-h-[90vh] overflow-y-auto"
      >
        {step === 'compose' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Send Email</DialogTitle>
              <DialogDescription>
                Compose an email to send to {eligibleClients.length} client
                {eligibleClients.length !== 1 ? 's' : ''}
                {skippedCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-500">
                    {' '}
                    ({skippedCount} without email will be skipped)
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {eligibleClients.length === 0 ? (
              <>
                <div className="py-6">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      None of the selected clients have email addresses.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <IconButtonWithText variant="destructive" onClick={handleClose}>
                    <X className="h-5 w-5" />
                    Cancel
                  </IconButtonWithText>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="py-4 space-y-4">
                  <div className="space-y-2 max-w-md">
                    <label className="text-sm font-medium">Choose Email Template</label>
                    <Select value={selectedTemplateId || "no-template"} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No template selected" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-template">No template</SelectItem>
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

                  <div className="w-full space-y-4">
                    {isLoadingTemplateContent ? (
                      <Card className="overflow-hidden flex flex-col p-0 min-h-[400px] items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                      </Card>
                    ) : (
                      <>
                        {/* Toolbar with Insert Variable button */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlaceholderDropdown
                            subjectInputRef={templateSubjectInputRef}
                            onEditorInsert={(id, label) => {
                              templateEditorRef.current?.insertPlaceholder(id, label);
                            }}
                          />
                          <div className="w-px h-6 bg-border" />
                          <EditorToolbar editor={editor} />
                        </div>

                        {/* Email Composer */}
                        <Card className="overflow-hidden flex flex-col p-0">
                          <SubjectLineEditor
                            ref={templateSubjectInputRef}
                            value={templateSubject}
                            onChange={setTemplateSubject}
                          />
                          <div className="flex-1">
                            <TemplateEditor
                              key={selectedTemplateId}
                              ref={templateEditorRef}
                              initialContent={templateBodyJson}
                              onUpdate={setTemplateBodyJson}
                            />
                          </div>
                        </Card>
                      </>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <IconButtonWithText variant="destructive" onClick={handleClose}>
                    <X className="h-5 w-5" />
                    Cancel
                  </IconButtonWithText>
                  <IconButtonWithText variant="blue" onClick={handleNext} disabled={isNextDisabled}>
                    <ArrowRight className="h-5 w-5" />
                    Next
                  </IconButtonWithText>
                </DialogFooter>
              </>
            )}
          </>
        )}

        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Preview & Confirm</DialogTitle>
              <DialogDescription>
                Preview for {eligibleClients[0]?.display_name || eligibleClients[0]?.company_name}.
                Placeholders will be personalized for each of the {eligibleClients.length} recipient{eligibleClients.length !== 1 ? 's' : ''}.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 w-full">
              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Card className="overflow-hidden flex flex-col p-0">
                  {/* Subject preview */}
                  <div className="flex items-center gap-3 border-b px-4 py-3 bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                    <div className="flex-1 text-sm">{editedSubject}</div>
                  </div>

                  {/* Body preview */}
                  <div className="p-4 bg-background">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">
                      {editedText}
                    </div>
                  </div>
                </Card>
              )}
            </div>

            <DialogFooter>
              <IconButtonWithText variant="destructive" onClick={handleClose}>
                <X className="h-5 w-5" />
                Cancel
              </IconButtonWithText>
              <IconButtonWithText variant="amber" onClick={handleBack}>
                <ArrowLeft className="h-5 w-5" />
                Back
              </IconButtonWithText>
              <IconButtonWithText variant="green" onClick={handleSend}>
                <Send className="h-5 w-5" />
                Send to {eligibleClients.length}
              </IconButtonWithText>
            </DialogFooter>
          </>
        )}

        {step === 'sending' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl">Sending Emails</DialogTitle>
                  <DialogDescription>
                    Please wait while emails are being sent...
                  </DialogDescription>
                </div>
              </div>
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
              <DialogTitle className="text-2xl">Send Complete</DialogTitle>
            </DialogHeader>

            <div className="py-4 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card className="py-5 shadow-sm transition-shadow duration-200 h-full">
                  <CardContent className="px-5 py-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Successfully Sent
                        </p>
                        <p className="text-4xl font-bold mt-3">
                          {sentCount}
                        </p>
                      </div>
                      <div className="size-10 rounded-lg bg-green-500/10 flex items-center justify-center transition-all duration-200">
                        <CheckCircle2 className="size-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="py-5 shadow-sm transition-shadow duration-200 h-full">
                  <CardContent className="px-5 py-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          Failed
                        </p>
                        <p className="text-4xl font-bold mt-3">
                          {failures.length}
                        </p>
                      </div>
                      <div className="size-10 rounded-lg bg-status-danger/10 flex items-center justify-center transition-all duration-200">
                        <XCircle className="size-6 text-status-danger" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {failures.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Failed sends:</p>
                  <div className="max-h-[200px] overflow-y-auto space-y-3 rounded-lg border shadow-sm bg-card p-4">
                    {failures.map((failure, idx) => (
                      <div key={idx} className="flex items-center gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                        <div className="px-3 py-1.5 rounded-md bg-status-danger/10 shrink-0">
                          <span className="text-sm font-medium text-status-danger">{failure.clientName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{failure.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <IconButtonWithText variant="destructive" onClick={handleClose}>
                <X className="h-5 w-5" />
                Close
              </IconButtonWithText>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
