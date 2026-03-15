"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ButtonBase } from "@/components/ui/button-base";
import { getFilingTypesForWizard, saveOrgFilingTypeSelections } from "../actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilingType {
  id: string;
  name: string;
  description: string | null;
  is_seeded_default: boolean;
  calculator_type: string;
  applicable_client_types: string[];
}

interface CategoryGroup {
  label: string;
  ids: string[];
}

export interface DeadlineSelectionStepProps {
  onComplete: (selectedIds: string[]) => void;
  onBack: () => void;
  initialSelection?: string[];
}

// ─── Category groupings ───────────────────────────────────────────────────────

const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: "Company Deadlines",
    ids: ["corporation_tax_payment", "ct600_filing", "companies_house", "confirmation_statement"],
  },
  {
    label: "VAT & MTD",
    ids: ["vat_return", "mtd_quarterly_update"],
  },
  {
    label: "Personal Tax",
    ids: ["self_assessment", "sa_payment_on_account", "partnership_tax_return", "trust_tax_return"],
  },
  {
    label: "Payroll & Employment",
    ids: ["p11d_filing", "paye_monthly", "cis_monthly_return", "payroll_year_end"],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function DeadlineSelectionStep({
  onComplete,
  onBack,
  initialSelection,
}: DeadlineSelectionStepProps) {
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load filing types on mount
  useEffect(() => {
    (async () => {
      const types = await getFilingTypesForWizard();
      setFilingTypes(types);

      // Determine initial checked state: use initialSelection if provided,
      // otherwise default-check all is_seeded_default types
      if (initialSelection && initialSelection.length > 0) {
        setSelectedIds(new Set(initialSelection));
      } else {
        const defaults = new Set(
          types.filter((t) => t.is_seeded_default).map((t) => t.id)
        );
        setSelectedIds(defaults);
      }

      setIsLoading(false);
    })();
  }, [initialSelection]);

  const handleToggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleContinue = async () => {
    setIsSaving(true);
    setSaveError(null);

    const activeIds = Array.from(selectedIds);
    const result = await saveOrgFilingTypeSelections(activeIds);

    if (result.error) {
      setSaveError(result.error);
      setIsSaving(false);
      return;
    }

    onComplete(activeIds);
  };

  const typeMap = new Map(filingTypes.map((t) => [t.id, t]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[520px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Choose your deadlines</h1>
          <p className="text-sm text-muted-foreground">
            Select the filing types you manage for your clients. The most common ones are
            pre-selected. You can change these at any time from your settings.
          </p>
        </div>

        <div className="space-y-4">
          {CATEGORY_GROUPS.map((group) => {
            // Only render groups where at least one type exists in the DB
            const groupTypes = group.ids
              .map((id) => typeMap.get(id))
              .filter((t): t is FilingType => t !== undefined);

            if (groupTypes.length === 0) return null;

            return (
              <Card key={group.label}>
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                    {group.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {groupTypes.map((ft) => (
                    <div key={ft.id} className="flex items-start gap-3">
                      <Checkbox
                        id={`ft-${ft.id}`}
                        checked={selectedIds.has(ft.id)}
                        onCheckedChange={(checked) =>
                          handleToggle(ft.id, checked === true)
                        }
                        className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5">
                        <Label
                          htmlFor={`ft-${ft.id}`}
                          className="text-sm font-medium cursor-pointer leading-tight"
                        >
                          {ft.name}
                        </Label>
                        {ft.description && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {ft.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {saveError && (
          <p className="text-sm text-destructive">{saveError}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <ButtonBase
          variant="amber"
          buttonType="icon-text"
          onClick={onBack}
          disabled={isSaving}
        >
          <ArrowLeft className="size-4" />
          Back
        </ButtonBase>
        <ButtonBase
          variant="green"
          buttonType="icon-text"
          onClick={handleContinue}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              Next Step
              <ArrowRight className="size-4" />
            </>
          )}
        </ButtonBase>
      </div>
    </div>
  );
}
