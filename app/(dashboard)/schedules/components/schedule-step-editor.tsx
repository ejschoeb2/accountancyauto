"use client";

import { useFieldArray, UseFormReturn } from "react-hook-form";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  templates: Array<{ id: string; name: string }>;
  filingTypes: Array<{ id: string; name: string }>;
}

export function ScheduleStepEditor({ form, templates, filingTypes }: ScheduleStepEditorProps) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  const addStep = () => {
    append({
      email_template_id: "",
      delay_days: 7,
    });
  };

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
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Schedule Steps</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
        >
          Add Step
        </Button>
      </div>

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
          <Card key={field.id} className="p-4 space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Step {index + 1}</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => moveDown(index)}
                  disabled={index === fields.length - 1}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>

            {/* Email Template selector */}
            <div className="space-y-2">
              <Label htmlFor={`steps.${index}.email_template_id`}>
                Email Template
              </Label>
              <Select
                value={form.watch(`steps.${index}.email_template_id`)}
                onValueChange={(value) => form.setValue(`steps.${index}.email_template_id`, value)}
              >
                <SelectTrigger id={`steps.${index}.email_template_id`}>
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
                <p className="text-sm text-destructive">
                  {form.formState.errors.steps[index].email_template_id?.message}
                </p>
              )}
            </div>

            {/* Days before deadline */}
            <div className="space-y-2">
              <Label>Days before deadline</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {[7, 14, 30].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={form.watch(`steps.${index}.delay_days`) === days ? "default" : "outline"}
                    size="sm"
                    onClick={() => form.setValue(`steps.${index}.delay_days`, days)}
                  >
                    {days} days
                  </Button>
                ))}
                <span className="text-sm text-muted-foreground">or</span>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  className="w-24"
                  {...form.register(`steps.${index}.delay_days`, {
                    valueAsNumber: true,
                  })}
                />
              </div>
              {form.formState.errors.steps?.[index]?.delay_days && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.steps[index].delay_days?.message}
                </p>
              )}
            </div>

            {/* Deadline reference */}
            <div className="space-y-2">
              <Label htmlFor={`steps.${index}.deadline_ref`}>
                Deadline
              </Label>
              <Select
                value={form.watch('filing_type_id')}
                onValueChange={(value) => form.setValue('filing_type_id', value as ScheduleInput['filing_type_id'])}
              >
                <SelectTrigger id={`steps.${index}.deadline_ref`}>
                  <SelectValue placeholder="Select deadline" />
                </SelectTrigger>
                <SelectContent>
                  {filingTypes.map((ft) => (
                    <SelectItem key={ft.id} value={ft.id}>
                      {ft.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The filing deadline this reminder counts back from
              </p>
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
