"use client";

import { useState } from "react";
import { UseFieldArrayReturn, UseFormReturn } from "react-hook-form";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
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

export function ScheduleStepEditor({ form, fieldArray, templates }: ScheduleStepEditorProps) {
  const { fields, remove, move } = fieldArray;
  const [customDelayDays, setCustomDelayDays] = useState<Record<number, boolean>>({});

  const moveUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  // Check for duplicate template IDs
  const stepTemplateIds = form.watch("steps").map(s => s.email_template_id).filter(id => id !== "");
  const duplicateTemplateIds = stepTemplateIds.filter((id, index) => stepTemplateIds.indexOf(id) !== index);
  const hasDuplicates = duplicateTemplateIds.length > 0;

  return (
    <div className="space-y-4">
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

      <div className="space-y-3">
        {fields.map((field, index) => (
          <Card key={field.id} className="p-8 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-4">
              <div className="text-3xl font-bold text-foreground">Step {index + 1}</div>
              <div className="flex items-center gap-2 shrink-0">
                <IconButton
                  type="button"
                  variant="neutral"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Move step up"
                >
                  <ChevronUp className="h-5 w-5" />
                </IconButton>
                <IconButton
                  type="button"
                  variant="neutral"
                  onClick={() => moveDown(index)}
                  disabled={index === fields.length - 1}
                  title="Move step down"
                >
                  <ChevronDown className="h-5 w-5" />
                </IconButton>
                <IconButton
                  type="button"
                  variant="destructive"
                  onClick={() => remove(index)}
                  title="Delete step"
                >
                  <Trash2 className="h-5 w-5" />
                </IconButton>
              </div>
            </div>

            {/* Horizontal layout - 2 column grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Email Template selector */}
              <div className="space-y-1.5">
                <Label htmlFor={`steps.${index}.email_template_id`} className="text-sm">
                  Email Template
                </Label>
                <Select
                  value={form.watch(`steps.${index}.email_template_id`)}
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

              {/* Days before deadline */}
              <div className="space-y-1.5">
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
            </div>

          </Card>
        ))}
      </div>

      {form.formState.errors.steps && typeof form.formState.errors.steps === 'object' && 'message' in form.formState.errors.steps && (
        <p className="text-sm text-destructive">
          {form.formState.errors.steps.message as string}
        </p>
      )}
    </div>
  );
}
