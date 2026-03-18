"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { CheckButton } from "@/components/ui/check-button";
import { ButtonBase } from "@/components/ui/button-base";
import {
  getFilingTypesForWizard,
  saveOrgFilingTypeSelections,
  getDocumentRequirementsForWizard,
  saveOrgDocumentSettings,
  type DocumentRequirement,
} from "../actions";

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

// ─── Part 1: Deadline Selection ───────────────────────────────────────────────

function DeadlineSelectionPart({
  onContinue,
  onBack,
  initialSelection,
}: {
  onContinue: (selectedIds: string[], filingTypes: FilingType[]) => void;
  onBack: () => void;
  initialSelection?: string[];
}) {
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const types = await getFilingTypesForWizard();
      setFilingTypes(types);

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
      if (checked) next.add(id); else next.delete(id);
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

    onContinue(activeIds, filingTypes);
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
    <div className="max-w-3xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Part 1 of 2</p>
          <h1 className="text-2xl font-bold tracking-tight">Choose your deadlines</h1>
          <p className="text-sm text-muted-foreground">
            Select the filing types you manage for your clients. The most common ones are
            pre-selected. You can change these at any time from your settings.
          </p>
        </div>

        <div className="space-y-5">
          {CATEGORY_GROUPS.map((group) => {
            const groupTypes = group.ids
              .map((id) => typeMap.get(id))
              .filter((t): t is FilingType => t !== undefined);

            if (groupTypes.length === 0) return null;

            return (
              <div key={group.label}>
                <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-1.5 px-1">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {groupTypes.map((ft) => (
                    <div
                      key={ft.id}
                      className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleToggle(ft.id, !selectedIds.has(ft.id))}
                    >
                      <CheckButton
                        checked={selectedIds.has(ft.id)}
                        onCheckedChange={(checked) =>
                          handleToggle(ft.id, checked)
                        }
                        aria-label={`Select ${ft.name}`}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-tight">
                          {ft.name}
                        </span>
                        {ft.description && (
                          <p className="text-xs text-muted-foreground leading-tight">
                            {ft.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
              Continue
              <ArrowRight className="size-4" />
            </>
          )}
        </ButtonBase>
      </div>
    </div>
  );
}

// ─── Part 2: Document Requirements ────────────────────────────────────────────

function DocumentRequirementsPart({
  selectedIds,
  filingTypes,
  onComplete,
  onBack,
}: {
  selectedIds: string[];
  filingTypes: FilingType[];
  onComplete: (selectedIds: string[]) => void;
  onBack: () => void;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [docRequirements, setDocRequirements] = useState<Record<string, DocumentRequirement[]>>({});
  // Track which documents are enabled: key = `${filingTypeId}::${documentTypeId}`
  const [enabledDocs, setEnabledDocs] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const nameMap = new Map(filingTypes.map((t) => [t.id, t.name]));

  useEffect(() => {
    (async () => {
      const reqs = await getDocumentRequirementsForWizard(selectedIds);
      setDocRequirements(reqs);

      // Default: all documents enabled
      const initial = new Set<string>();
      for (const [ftId, docs] of Object.entries(reqs)) {
        for (const doc of docs) {
          initial.add(`${ftId}::${doc.document_type_id}`);
        }
      }
      setEnabledDocs(initial);
      setIsLoading(false);
    })();
  }, [selectedIds]);

  const handleToggle = (filingTypeId: string, docTypeId: string, checked: boolean) => {
    const key = `${filingTypeId}::${docTypeId}`;
    setEnabledDocs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const handleToggleAll = (filingTypeId: string, checked: boolean) => {
    setEnabledDocs((prev) => {
      const next = new Set(prev);
      const docs = docRequirements[filingTypeId] ?? [];
      for (const doc of docs) {
        const key = `${filingTypeId}::${doc.document_type_id}`;
        if (checked) next.add(key); else next.delete(key);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    // Build settings array — include all documents with their enabled state
    const settings: Array<{ filing_type_id: string; document_type_id: string; is_enabled: boolean }> = [];
    for (const [ftId, docs] of Object.entries(docRequirements)) {
      for (const doc of docs) {
        const key = `${ftId}::${doc.document_type_id}`;
        settings.push({
          filing_type_id: ftId,
          document_type_id: doc.document_type_id,
          is_enabled: enabledDocs.has(key),
        });
      }
    }

    const result = await saveOrgDocumentSettings(settings);

    if (result.error) {
      setSaveError(result.error);
      setIsSaving(false);
      return;
    }

    onComplete(selectedIds);
  };

  // Filter to filing types that actually have document requirements
  const typesWithDocs = selectedIds.filter(
    (id) => (docRequirements[id] ?? []).length > 0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[520px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Part 2 of 2</p>
          <h1 className="text-2xl font-bold tracking-tight">Document requirements</h1>
          <p className="text-sm text-muted-foreground">
            Choose which documents you require from clients for each deadline. These form the
            checklist clients see in their portal. You can customise per-client later.
          </p>
        </div>

        {typesWithDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            None of your selected deadlines require client documents.
          </p>
        ) : (
          <div className="space-y-4">
            {typesWithDocs.map((ftId) => {
              const docs = docRequirements[ftId] ?? [];
              const allChecked = docs.every((d) => enabledDocs.has(`${ftId}::${d.document_type_id}`));
              const noneChecked = docs.every((d) => !enabledDocs.has(`${ftId}::${d.document_type_id}`));

              return (
                <div key={ftId} className="rounded-lg border bg-muted/30 overflow-hidden">
                  {/* Filing type header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleToggleAll(ftId, !allChecked)}
                  >
                    <CheckButton
                      checked={allChecked ? true : noneChecked ? false : "indeterminate"}
                      onCheckedChange={(checked) => handleToggleAll(ftId, checked)}
                      aria-label={`Toggle all for ${nameMap.get(ftId)}`}
                    />
                    <span className="text-sm font-semibold">{nameMap.get(ftId)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {docs.filter((d) => enabledDocs.has(`${ftId}::${d.document_type_id}`)).length}/{docs.length} selected
                    </span>
                  </div>

                  {/* Document checkboxes */}
                  <div className="px-4 py-2 space-y-0.5">
                    {docs.map((doc) => {
                      const key = `${ftId}::${doc.document_type_id}`;
                      const isChecked = enabledDocs.has(key);
                      return (
                        <div
                          key={doc.document_type_id}
                          className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleToggle(ftId, doc.document_type_id, !isChecked)}
                        >
                          <CheckButton
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              handleToggle(ftId, doc.document_type_id, checked)
                            }
                            aria-label={`Select ${doc.label}`}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm leading-tight">
                              {doc.label}
                            </span>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground leading-tight line-clamp-1">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
          onClick={handleSave}
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

// ─── Combined Component ───────────────────────────────────────────────────────

export function DeadlineSelectionStep({
  onComplete,
  onBack,
  initialSelection,
}: DeadlineSelectionStepProps) {
  const [part, setPart] = useState<1 | 2>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);

  if (part === 1) {
    return (
      <DeadlineSelectionPart
        initialSelection={initialSelection}
        onBack={onBack}
        onContinue={(ids, types) => {
          setSelectedIds(ids);
          setFilingTypes(types);
          setPart(2);
        }}
      />
    );
  }

  return (
    <DocumentRequirementsPart
      selectedIds={selectedIds}
      filingTypes={filingTypes}
      onComplete={onComplete}
      onBack={() => setPart(1)}
    />
  );
}
