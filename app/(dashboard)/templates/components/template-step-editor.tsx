"use client";

import { useFieldArray, UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Icon } from "@/components/ui/icon";
import type { TemplateInput } from "@/lib/validations/template";

interface TemplateStepEditorProps {
  form: UseFormReturn<TemplateInput>;
}

export function TemplateStepEditor({ form }: TemplateStepEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "steps",
  });

  const addStep = () => {
    if (fields.length < 5) {
      append({
        step_number: fields.length + 1,
        delay_days: 7,
        subject: "",
        body: "",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Reminder Steps</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addStep}
          disabled={fields.length >= 5}
        >
          Add Step
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No steps yet. Click "Add Step" to create your first reminder.
        </p>
      )}

      <Accordion type="single" collapsible className="w-full">
        {fields.map((field, index) => (
          <AccordionItem key={field.id} value={`step-${index}`}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-2">
                <span className="font-medium">
                  Step {index + 1}
                  {form.watch(`steps.${index}.subject`) && (
                    <span className="text-muted-foreground font-normal ml-2">
                      - {form.watch(`steps.${index}.subject`)}
                    </span>
                  )}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <input
                  type="hidden"
                  {...form.register(`steps.${index}.step_number`)}
                  value={index + 1}
                />

                <div className="space-y-2">
                  <Label htmlFor={`steps.${index}.delay_days`}>
                    Days before deadline
                  </Label>
                  <Input
                    id={`steps.${index}.delay_days`}
                    type="number"
                    min={1}
                    max={365}
                    {...form.register(`steps.${index}.delay_days`, {
                      valueAsNumber: true,
                    })}
                  />
                  {form.formState.errors.steps?.[index]?.delay_days && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.steps[index].delay_days?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`steps.${index}.subject`}>Subject</Label>
                  <Input
                    id={`steps.${index}.subject`}
                    placeholder="e.g., Reminder: {{filing_type}} due {{deadline}}"
                    {...form.register(`steps.${index}.subject`)}
                  />
                  {form.formState.errors.steps?.[index]?.subject && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.steps[index].subject?.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`steps.${index}.body`}>Body</Label>
                  <Textarea
                    id={`steps.${index}.body`}
                    rows={8}
                    placeholder="Use {{client_name}}, {{deadline}}, etc."
                    {...form.register(`steps.${index}.body`)}
                  />
                  {form.formState.errors.steps?.[index]?.body && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.steps[index].body?.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => remove(index)}
                  >
                    <Icon name="delete" size="sm" className="mr-2" />
                    Remove Step
                  </Button>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {form.formState.errors.steps && (
        <p className="text-sm text-destructive">
          {form.formState.errors.steps.message}
        </p>
      )}
    </div>
  );
}
