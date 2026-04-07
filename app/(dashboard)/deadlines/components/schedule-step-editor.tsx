"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { Trash2, Plus, Pencil, CheckCircle, X, Link, AlertCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateEditor } from "../../templates/components/template-editor";
import { SubjectLineEditor } from "../../templates/components/subject-line-editor";
import { PlaceholderDropdown } from "../../templates/components/placeholder-dropdown";
import { EditorToolbar } from "../../templates/components/template-editor-toolbar";
import type { ScheduleInput } from "@/lib/validations/schedule";
import type { TipTapDocument, EmailTemplate } from "@/lib/types/database";
import { filterTemplatesByFilingType } from "@/lib/templates/filter";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { logger } from '@/lib/logger';

interface ScheduleStepEditorProps {
  form: UseFormReturn<ScheduleInput>;
  fieldArray: UseFieldArrayReturn<ScheduleInput, "steps">;
  templates: Array<{ id: string; name: string; is_custom?: boolean; filing_type_id?: string | null }>;
  scheduleType?: 'filing' | 'custom';
  filingTypeId?: string;
}

export function ScheduleStepAddButton({ onAdd }: { onAdd: () => void }) {
  return (
    <IconButtonWithText
      type="button"
      variant="blue"
      onClick={onAdd}
      title="Add step"
    >
      <Plus className="h-5 w-5" />
      Add Step
    </IconButtonWithText>
  );
}

// Simple component to render TipTap JSON as read-only preview
function EmailBodyPreview({ content }: { content: TipTapDocument }) {
  const renderNode = (node: any, index: number): React.ReactNode => {
    switch (node.type) {
      case 'paragraph':
        return (
          <p key={index} className="mb-2 last:mb-0">
            {node.content?.map((child: any, i: number) => renderNode(child, i)) || <br />}
          </p>
        );
      case 'text':
        let text = <span key={index}>{node.text}</span>;
        if (node.marks) {
          node.marks.forEach((mark: any) => {
            if (mark.type === 'bold') {
              text = <strong key={index}>{text}</strong>;
            } else if (mark.type === 'italic') {
              text = <em key={index}>{text}</em>;
            } else if (mark.type === 'link') {
              text = (
                <a key={index} href={mark.attrs.href} className="text-primary underline">
                  {text}
                </a>
              );
            }
          });
        }
        return text;
      case 'placeholder':
        return (
          <span key={index} className="inline-flex items-center rounded-md bg-sky-500/10 text-sky-600 px-3 py-1 text-sm font-medium">
            {node.attrs.label}
          </span>
        );
      case 'bulletList':
        return (
          <ul key={index} className="list-disc pl-6 mb-2">
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </ul>
        );
      case 'orderedList':
        return (
          <ol key={index} className="list-decimal pl-6 mb-2">
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </ol>
        );
      case 'listItem':
        return (
          <li key={index}>
            {node.content?.map((child: any, i: number) => renderNode(child, i))}
          </li>
        );
      case 'hardBreak':
        return <br key={index} />;
      default:
        return null;
    }
  };

  return (
    <div className="prose prose-sm max-w-none text-sm">
      {content.content?.map((node, i) => renderNode(node, i))}
    </div>
  );
}

// Renders a subject line with {{variable}} tokens as styled pills
function SubjectPreview({ subject }: { subject: string }) {
  const parts = useMemo(() => {
    const result: Array<{ type: 'text' | 'variable'; content: string }> = []
    let lastIndex = 0
    const regex = /\{\{([^}]+)\}\}/g
    let match
    while ((match = regex.exec(subject)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: subject.slice(lastIndex, match.index) })
      }
      const label = match[1].split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      result.push({ type: 'variable', content: label })
      lastIndex = regex.lastIndex
    }
    if (lastIndex < subject.length) {
      result.push({ type: 'text', content: subject.slice(lastIndex) })
    }
    return result
  }, [subject])

  return (
    <div className="flex items-center flex-wrap gap-x-0.5">
      {parts.map((part, i) =>
        part.type === 'variable' ? (
          <span key={i} className="inline-flex items-center rounded-md bg-sky-500/10 text-sky-600 px-3 py-1 text-sm font-medium">
            {part.content}
          </span>
        ) : (
          <span key={i} className="text-sm">{part.content}</span>
        )
      )}
    </div>
  )
}

interface TemplateData {
  id: string;
  name: string;
  subject: string;
  body_json: TipTapDocument;
}

export function ScheduleStepEditor({ form, fieldArray, templates, scheduleType, filingTypeId }: ScheduleStepEditorProps) {
  const router = useRouter();
  const { fields, remove } = fieldArray;
  const [customDelayDays, setCustomDelayDays] = useState<Record<number, boolean>>({});
  const [templateData, setTemplateData] = useState<Record<string, TemplateData>>({});
  const [loadingTemplates, setLoadingTemplates] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Template editor state
  const [editSubject, setEditSubject] = useState("");
  const [editBodyJson, setEditBodyJson] = useState<TipTapDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<any>(null);
  const [creatingForStepIndex, setCreatingForStepIndex] = useState<number | null>(null);

  // Refs for placeholder insertion and tracking
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<{ insertPlaceholder: (id: string, label: string) => void; getEditor: () => any } | null>(null);
  const loadingRef = useRef<Set<string>>(new Set());

  // Update editor state when ref changes
  useEffect(() => {
    const interval = setInterval(() => {
      if (editorRef.current) {
        const ed = editorRef.current.getEditor();
        if (ed && ed !== editor) {
          setEditor(ed);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [editor]);

  // Load template data when step template IDs change
  const watchedSteps = form.watch("steps");
  const stepTemplateIdKey = watchedSteps.map(s => s.email_template_id).filter(Boolean).join(",");

  useEffect(() => {
    watchedSteps.forEach((step) => {
      const id = step.email_template_id;
      if (id && !templateData[id] && !loadingRef.current.has(id)) {
        loadingRef.current.add(id);
        setLoadingTemplates(prev => new Set(prev).add(id));

        fetch(`/api/email-templates/${id}`)
          .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to load')))
          .then(data => {
            setTemplateData(prev => ({
              ...prev,
              [id]: {
                id: data.id,
                name: data.name,
                subject: data.subject,
                body_json: data.body_json,
              },
            }));
          })
          .catch(err => logger.error('Failed to load template:', err))
          .finally(() => {
            loadingRef.current.delete(id);
            setLoadingTemplates(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          });
      }
    });
  }, [stepTemplateIdKey]);

  // Check for duplicate template IDs
  const stepTemplateIds = form.watch("steps").map(s => s.email_template_id).filter(id => id !== "");
  const duplicateTemplateIds = stepTemplateIds.filter((id, index) => stepTemplateIds.indexOf(id) !== index);
  const hasDuplicates = duplicateTemplateIds.length > 0;

  // Open edit dialog and load template data
  const handleEditTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/email-templates/${templateId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Template not found");
        } else {
          const error = await response.json();
          toast.error(error.error || "Failed to load template");
        }
        return;
      }

      const template: EmailTemplate = await response.json();
      setEditSubject(template.subject);
      setEditBodyJson(template.body_json);
      setEditingTemplateId(templateId);
      setEditDialogOpen(true);
    } catch (error) {
      toast.error("Failed to load template");
    }
  };

  // Close dialog and reset state
  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setCreatingForStepIndex(null);
    setEditingTemplateId(null);
  };

  // Save template changes (create or update)
  const handleSaveTemplate = async () => {
    // Validation
    if (!editSubject.trim()) {
      toast.error("Subject line is required");
      return;
    }
    if (!editBodyJson) {
      toast.error("Email body is required");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplateId) {
        // Update existing template (PUT)
        const response = await fetch(`/api/email-templates/${editingTemplateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: editSubject,
            body_json: editBodyJson,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update template");
        }

        toast.success("Template updated!");
        handleCloseDialog();
        // Reload template data
        setTemplateData((prev) => {
          const next = { ...prev };
          delete next[editingTemplateId];
          return next;
        });
        loadingRef.current.delete(editingTemplateId);
        router.refresh();
      } else {
        // Create new template (POST)
        const templateName = editSubject.trim().substring(0, 100);
        const response = await fetch("/api/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName,
            subject: editSubject,
            body_json: editBodyJson,
            is_active: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create template");
        }

        const newTemplate = await response.json();

        // Link template to the step
        if (creatingForStepIndex !== null) {
          form.setValue(`steps.${creatingForStepIndex}.email_template_id`, newTemplate.id, { shouldDirty: true });
        }

        // Cache the template data locally
        setTemplateData((prev) => ({
          ...prev,
          [newTemplate.id]: {
            id: newTemplate.id,
            name: newTemplate.name,
            subject: newTemplate.subject,
            body_json: newTemplate.body_json,
          },
        }));

        toast.success("Email template created!");
        handleCloseDialog();
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {hasDuplicates && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 rounded-xl">
          <AlertTriangle className="size-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-600">
            The same email template is assigned to multiple steps. This is allowed, but recipients will receive similar emails at different intervals.
          </p>
        </div>
      )}

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No steps added. Click "Add Step" to define when reminders are sent.
        </p>
      )}

      <div className="space-y-6">
        {fields.map((field, index) => {
          const selectedTemplateId = form.watch(`steps.${index}.email_template_id`);
          const template = selectedTemplateId ? templateData[selectedTemplateId] : null;
          const isLoading = selectedTemplateId ? loadingTemplates.has(selectedTemplateId) : false;

          return (
            <div key={field.id} className="flex gap-4">
              {/* Step number - outside the box */}
              <div className="flex-shrink-0 w-12 pt-4">
                <div className="text-2xl font-bold text-foreground">
                  {index + 1}.
                </div>
              </div>

              {/* Step content */}
              <Card className="flex-1 p-5 space-y-4">
                {/* Controls row */}
                <div className="flex items-start justify-between gap-4">
                  {/* Delay and template selector */}
                  <div className="flex-1 flex gap-3">
                    {/* Days before deadline */}
                    <div className="space-y-1.5 w-[200px]">
                      <Label className="text-sm">Days before deadline</Label>
                      <div className="flex items-end gap-1.5">
                        <Select
                          value={customDelayDays[index] ? "custom" : String(form.watch(`steps.${index}.delay_days`))}
                          onValueChange={(value) => {
                            if (value === "custom") {
                              setCustomDelayDays({ ...customDelayDays, [index]: true });
                            } else {
                              form.setValue(`steps.${index}.delay_days`, Number(value), { shouldDirty: true });
                              setCustomDelayDays({ ...customDelayDays, [index]: false });
                            }
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="14">14 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {customDelayDays[index] && (
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            className="w-20 h-9 text-sm flex-shrink-0"
                            placeholder="days"
                            {...form.register(`steps.${index}.delay_days`, {
                              valueAsNumber: true,
                            })}
                          />
                        )}
                      </div>
                      {form.formState.errors.steps?.[index]?.delay_days && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.steps[index].delay_days?.message}
                        </p>
                      )}
                    </div>

                    {/* Email Template selector */}
                    <div className="space-y-1.5 flex-1">
                      <Label htmlFor={`steps.${index}.email_template_id`} className="text-sm">
                        Email Template
                      </Label>
                      <Select
                        value={selectedTemplateId || "__none__"}
                        onValueChange={(value) => form.setValue(`steps.${index}.email_template_id`, value === "__none__" ? "" : value, { shouldDirty: true })}
                      >
                        <SelectTrigger id={`steps.${index}.email_template_id`} className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No template</SelectItem>
                          {filterTemplatesByFilingType(templates, filingTypeId).map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.steps?.[index]?.email_template_id && (
                        <p className="text-xs text-destructive">
                          {form.formState.errors.steps[index].email_template_id?.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Edit and Delete buttons */}
                  <div className="shrink-0 pt-6 flex items-center gap-2">
                    {selectedTemplateId ? (
                      <IconButtonWithText
                        type="button"
                        variant="violet"
                        onClick={() => handleEditTemplate(selectedTemplateId)}
                        title="Edit template"
                      >
                        <Pencil className="h-5 w-5" />
                        Edit Template
                      </IconButtonWithText>
                    ) : (
                      <IconButtonWithText
                        type="button"
                        variant="violet"
                        onClick={() => {
                          setEditSubject("");
                          setEditBodyJson({ type: "doc", content: [{ type: "paragraph" }] });
                          setEditingTemplateId(null);
                          setCreatingForStepIndex(index);
                          setEditDialogOpen(true);
                        }}
                        title="Compose email"
                      >
                        <Pencil className="h-5 w-5" />
                        Compose Email
                      </IconButtonWithText>
                    )}
                    <div className="h-8 w-px bg-border" />
                    <IconButtonWithText
                      type="button"
                      variant="destructive"
                      onClick={() => remove(index)}
                      title="Delete step"
                    >
                      <Trash2 className="h-5 w-5" />
                      Delete Step
                    </IconButtonWithText>
                  </div>
                </div>

                {/* Email preview area */}
                <div className="border rounded-lg overflow-hidden bg-card">
                  {isLoading ? (
                    <div className="p-4 text-sm text-muted-foreground">
                      Loading template preview...
                    </div>
                  ) : template ? (
                    <>
                      {/* Header with subject */}
                      <div className="border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                          <SubjectPreview subject={template.subject} />
                        </div>
                      </div>

                      {/* Body preview */}
                      <div className="p-4">
                        <EmailBodyPreview content={template.body_json} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="border-b px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                          <span className="text-sm text-muted-foreground/50 italic">No template selected</span>
                        </div>
                      </div>
                      <div className="p-4 min-h-[80px]">
                        <p className="text-sm text-muted-foreground/50 italic">
                          Select a template or compose a new email to preview content here.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {form.formState.errors.steps && typeof form.formState.errors.steps === 'object' && 'message' in form.formState.errors.steps && (
        <p className="text-sm text-destructive">
          {form.formState.errors.steps.message as string}
        </p>
      )}

      {/* Edit / Create Template Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="[&>button]:hidden sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-3xl">
              {editingTemplateId ? "Edit Template" : "Compose Email"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplateId
                ? "Changes here update the template globally — all deadlines that use this template will be affected."
                : "Compose the email for this reminder step. A new email template will be created."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Toolbar with Insert Variable + Insert Portal Link buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <PlaceholderDropdown
                subjectInputRef={subjectInputRef}
                onEditorInsert={(id, label) => {
                  editorRef.current?.insertPlaceholder(id, label);
                }}
              />
              {scheduleType !== 'custom' && (
                <Button
                  variant="ghost"
                  type="button"
                  className="px-4 py-2 h-10 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-500 hover:text-violet-500 transition-all duration-200 active:scale-[0.97] flex items-center gap-2 text-sm font-medium"
                  title="Insert portal link placeholder"
                  onClick={() => {
                    editorRef.current?.insertPlaceholder('portal_link', 'Portal Link');
                  }}
                >
                  <Link className="h-5 w-5" />
                  Insert Portal Link
                </Button>
              )}
              <div className="w-px h-6 bg-border" />
              <EditorToolbar editor={editor} />
            </div>

            {/* Email Composer */}
            <Card className="overflow-hidden flex flex-col p-0">
              {/* Subject Line */}
              <SubjectLineEditor
                ref={subjectInputRef}
                value={editSubject}
                onChange={setEditSubject}
              />

              {/* Email Body */}
              <div className="flex-1">
                <TemplateEditor
                  key={editingTemplateId ?? "new"}
                  ref={editorRef}
                  initialContent={editBodyJson}
                  onUpdate={setEditBodyJson}
                />
              </div>
            </Card>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-4">
              <IconButtonWithText
                type="button"
                variant="amber"
                onClick={handleCloseDialog}
                disabled={saving}
              >
                <X className="h-5 w-5" />
                Cancel
              </IconButtonWithText>
              <IconButtonWithText
                type="button"
                variant="blue"
                onClick={handleSaveTemplate}
                disabled={saving}
                title={saving ? "Saving..." : editingTemplateId ? "Save template" : "Create template"}
              >
                <CheckCircle className="h-5 w-5" />
                {saving ? "Saving..." : editingTemplateId ? "Save changes to template" : "Create email template"}
              </IconButtonWithText>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
