"use client";

import { useState, useEffect } from "react";
import { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { Trash2, Plus } from "lucide-react";
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
import type { ScheduleInput } from "@/lib/validations/schedule";
import type { TipTapDocument } from "@/lib/types/database";

interface ScheduleStepEditorProps {
  form: UseFormReturn<ScheduleInput>;
  fieldArray: UseFieldArrayReturn<ScheduleInput, "steps">;
  templates: Array<{ id: string; name: string }>;
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
          <span key={index} className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-sm font-medium">
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

interface TemplateData {
  id: string;
  name: string;
  subject: string;
  body_json: TipTapDocument;
}

export function ScheduleStepEditor({ form, fieldArray, templates }: ScheduleStepEditorProps) {
  const { fields, remove } = fieldArray;
  const [customDelayDays, setCustomDelayDays] = useState<Record<number, boolean>>({});
  const [templateData, setTemplateData] = useState<Record<string, TemplateData>>({});
  const [loadingTemplates, setLoadingTemplates] = useState<Set<string>>(new Set());

  // Load template data when a template is selected
  useEffect(() => {
    const loadTemplate = async (templateId: string) => {
      if (templateData[templateId] || loadingTemplates.has(templateId)) {
        return;
      }

      setLoadingTemplates(prev => new Set(prev).add(templateId));

      try {
        const response = await fetch(`/api/email-templates/${templateId}`);
        if (response.ok) {
          const data = await response.json();
          setTemplateData(prev => ({
            ...prev,
            [templateId]: {
              id: data.id,
              name: data.name,
              subject: data.subject,
              body_json: data.body_json,
            },
          }));
        }
      } catch (error) {
        console.error('Failed to load template:', error);
      } finally {
        setLoadingTemplates(prev => {
          const next = new Set(prev);
          next.delete(templateId);
          return next;
        });
      }
    };

    // Load templates for all selected steps
    form.watch("steps").forEach((step) => {
      if (step.email_template_id) {
        loadTemplate(step.email_template_id);
      }
    });
  }, [form.watch("steps")]);

  // Check for duplicate template IDs
  const stepTemplateIds = form.watch("steps").map(s => s.email_template_id).filter(id => id !== "");
  const duplicateTemplateIds = stepTemplateIds.filter((id, index) => stepTemplateIds.indexOf(id) !== index);
  const hasDuplicates = duplicateTemplateIds.length > 0;

  return (
    <div className="space-y-6">
      {hasDuplicates && (
        <div className="rounded-lg border border-yellow-600/50 bg-yellow-600/10 p-4">
          <p className="text-sm text-foreground">
            Note: The same email template is assigned to multiple steps. This is allowed, but recipients will receive similar emails at different intervals.
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
                              form.setValue(`steps.${index}.delay_days`, Number(value));
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
                        value={selectedTemplateId}
                        onValueChange={(value) => form.setValue(`steps.${index}.email_template_id`, value)}
                      >
                        <SelectTrigger id={`steps.${index}.email_template_id`} className="h-9">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
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

                  {/* Delete button */}
                  <div className="shrink-0 pt-6">
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

                {/* Email preview - always shown when template is selected */}
                {selectedTemplateId && (
                  <div className="border rounded-lg overflow-hidden bg-card">
                    {isLoading ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        Loading template preview...
                      </div>
                    ) : template ? (
                      <>
                        {/* Subject preview */}
                        <div className="border-b px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground shrink-0">Subject:</span>
                            <span className="text-sm">{template.subject}</span>
                          </div>
                        </div>

                        {/* Body preview */}
                        <div className="p-4">
                          <EmailBodyPreview content={template.body_json} />
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
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
    </div>
  );
}
