"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TemplateStepEditor } from "../../components/template-step-editor";
import { templateSchema, type TemplateInput } from "@/lib/validations/template";
import { AVAILABLE_PLACEHOLDERS } from "@/lib/templates/variables";
import type { ReminderTemplate, FilingType } from "@/lib/types/database";
import { toast } from "sonner";

type TemplateWithFilingType = ReminderTemplate & {
  filing_types: FilingType;
};

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const isNew = templateId === "new";

  const [loading, setLoading] = useState(!isNew);
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);

  const form = useForm<TemplateInput>({
    resolver: zodResolver(templateSchema) as any,
    defaultValues: {
      filing_type_id: "corporation_tax_payment",
      name: "",
      description: "",
      steps: [],
      is_active: true,
    },
  });

  // Load filing types
  useEffect(() => {
    fetch("/api/filing-types")
      .then((res) => res.json())
      .then((data) => setFilingTypes(data.filing_types || []))
      .catch((err) => {
        console.error("Failed to load filing types:", err);
        toast.error("Failed to load filing types");
      });
  }, []);

  // Load existing template
  useEffect(() => {
    if (!isNew) {
      fetch(`/api/templates/${templateId}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load template");
          return res.json();
        })
        .then((data: TemplateWithFilingType) => {
          form.reset({
            filing_type_id: data.filing_type_id,
            name: data.name,
            description: data.description || "",
            steps: data.steps,
            is_active: data.is_active,
          });
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to load template:", err);
          toast.error("Failed to load template");
          router.push("/templates");
        });
    }
  }, [isNew, templateId, form, router]);

  const onSubmit = async (data: TemplateInput) => {
    try {
      const url = isNew ? "/api/templates" : `/api/templates/${templateId}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save template");
      }

      toast.success(isNew ? "Template created!" : "Template updated!");
      router.push("/templates");
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete template");
      }

      toast.success("Template deleted!");
      router.push("/templates");
    } catch (err) {
      console.error("Failed to delete template:", err);
      toast.error("Failed to delete template");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isNew ? "Create Template" : "Edit Template"}
        </h1>
        {!isNew && (
          <Button variant="destructive" onClick={handleDelete}>
            Delete Template
          </Button>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
        <div className="rounded-lg border p-8 space-y-6">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div className="space-y-2">
            <Label htmlFor="filing_type_id">Filing Type</Label>
            <Select
              value={form.watch("filing_type_id")}
              onValueChange={(value) =>
                form.setValue("filing_type_id", value as any)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select filing type" />
              </SelectTrigger>
              <SelectContent>
                {filingTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.filing_type_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.filing_type_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              className="hover:border-foreground/20"
              placeholder="e.g., Standard Corporation Tax Reminders"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              className="hover:border-foreground/20"
              placeholder="Internal notes about this template"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_active"
              checked={form.watch("is_active")}
              onCheckedChange={(checked) =>
                form.setValue("is_active", checked as boolean)
              }
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active (will be used for new reminders)
            </Label>
          </div>
        </div>

        <div className="rounded-lg border p-8 space-y-6">
          <TemplateStepEditor form={form} />
        </div>

        <div className="rounded-lg border p-8 space-y-4">
          <h2 className="text-lg font-semibold">Available Placeholders</h2>
          <p className="text-sm text-muted-foreground">
            Use these placeholders in your subject and body text. They will be
            replaced with actual values when reminders are sent.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {AVAILABLE_PLACEHOLDERS.map((placeholder) => (
              <div
                key={placeholder.name}
                className="rounded-lg border p-3 space-y-1"
              >
                <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                  {`{{${placeholder.name}}}`}
                </code>
                <p className="text-sm text-muted-foreground">
                  {placeholder.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/templates")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting} className="active:scale-[0.97]">
            {form.formState.isSubmitting
              ? "Saving..."
              : isNew
              ? "Create Template"
              : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
