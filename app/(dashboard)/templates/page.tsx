import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReminderTemplate, FilingType } from "@/lib/types/database";

type TemplateWithFilingType = ReminderTemplate & {
  filing_types: FilingType;
};

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("reminder_templates")
    .select(`
      *,
      filing_types (
        id,
        name,
        description
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reminder Templates</h1>
        <Link href="/templates/new">
          <Button>Create Template</Button>
        </Link>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(templates as TemplateWithFilingType[]).map((template) => (
            <Link
              key={template.id}
              href={`/templates/${template.id}/edit`}
              className="block"
            >
              <div className="rounded-lg border bg-card p-6 hover:shadow-md hover:border-accent/30 transition-colors">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {template.filing_types.name}
                    </p>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {template.steps.length} {template.steps.length === 1 ? "step" : "steps"}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No templates yet</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Create your first reminder template to get started.
          </p>
          <Link href="/templates/new">
            <Button className="mt-4">Create Template</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
