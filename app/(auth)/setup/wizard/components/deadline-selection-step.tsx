"use client";

import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, ArrowRight, Loader2, Building2, Users, Handshake, User } from "lucide-react";
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

type ClientType = "Limited Company" | "LLP" | "Partnership" | "Individual";

export interface DeadlineSelectionStepProps {
  onComplete: (selectedIds: string[], clientTypes: string[], disabledDocuments: string[]) => void;
  onBack: () => void;
  initialSelection?: string[];
  initialClientTypes?: string[];
  initialDisabledDocuments?: string[];
}

// ─── Client type definitions ─────────────────────────────────────────────────

const CLIENT_TYPES: { value: ClientType; label: string; description: string; icon: typeof Building2 }[] = [
  {
    value: "Limited Company",
    label: "Limited Companies",
    description: "Private limited companies (Ltd)",
    icon: Building2,
  },
  {
    value: "LLP",
    label: "LLPs",
    description: "Limited liability partnerships",
    icon: Handshake,
  },
  {
    value: "Partnership",
    label: "Partnerships",
    description: "General and business partnerships",
    icon: Users,
  },
  {
    value: "Individual",
    label: "Individuals",
    description: "Sole traders and personal tax clients",
    icon: User,
  },
];

// ─── Part 1: Client Type Selection ───────────────────────────────────────────

function ClientTypeSelectionPart({
  onContinue,
  onBack,
  initialClientTypes,
}: {
  onContinue: (clientTypes: Set<ClientType>) => void;
  onBack: () => void;
  initialClientTypes?: Set<ClientType>;
}) {
  const [selectedTypes, setSelectedTypes] = useState<Set<ClientType>>(
    initialClientTypes ?? new Set()
  );

  const handleToggle = (type: ClientType, checked: boolean) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(type); else next.delete(type);
      return next;
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">What types of clients do you manage?</h1>
          <p className="text-sm text-muted-foreground">
            Select the entity types your practice works with. This helps us show you the
            relevant filing deadlines in the next step.
          </p>
        </div>

        <div className="space-y-1.5">
          {CLIENT_TYPES.map((ct) => {
            const Icon = ct.icon;
            const isSelected = selectedTypes.has(ct.value);
            return (
              <div
                key={ct.value}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => handleToggle(ct.value, !isSelected)}
              >
                <CheckButton
                  checked={isSelected}
                  onCheckedChange={(checked) => handleToggle(ct.value, checked)}
                  aria-label={`Select ${ct.label}`}
                />
                <Icon className="size-5 text-muted-foreground shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">{ct.label}</span>
                  <p className="text-xs text-muted-foreground leading-tight">{ct.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <ButtonBase
          variant="amber"
          buttonType="icon-text"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          Back
        </ButtonBase>
        <ButtonBase
          variant="blue"
          buttonType="icon-text"
          onClick={() => onContinue(selectedTypes)}
          disabled={selectedTypes.size === 0}
        >
          Continue
          <ArrowRight className="size-4" />
        </ButtonBase>
      </div>
    </div>
  );
}

// ─── Part 2: Deadline Selection (grouped by client type) ─────────────────────

function DeadlineSelectionPart({
  selectedClientTypes,
  onContinue,
  onBack,
  initialSelection,
}: {
  selectedClientTypes: Set<ClientType>;
  onContinue: (selectedIds: string[], filingTypes: FilingType[]) => void;
  onBack: () => void;
  initialSelection?: string[];
}) {
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Build groups: filing types grouped by selected client type
  const clientTypeGroups = useMemo(() => {
    if (filingTypes.length === 0) return [];

    const clientTypeLabels: Record<ClientType, string> = {
      "Limited Company": "Limited Company Deadlines",
      "LLP": "LLP Deadlines",
      "Partnership": "Partnership Deadlines",
      "Individual": "Individual Deadlines",
    };

    return CLIENT_TYPES
      .filter((ct) => selectedClientTypes.has(ct.value))
      .map((ct) => ({
        clientType: ct.value,
        label: clientTypeLabels[ct.value],
        filingTypes: filingTypes.filter((ft) =>
          ft.applicable_client_types.includes(ct.value)
        ),
      }))
      .filter((g) => g.filingTypes.length > 0);
  }, [filingTypes, selectedClientTypes]);

  useEffect(() => {
    (async () => {
      const types = await getFilingTypesForWizard();
      setFilingTypes(types);

      if (initialSelection && initialSelection.length > 0) {
        setSelectedIds(new Set(initialSelection));
      } else {
        // Default: select all seeded defaults that are applicable to chosen client types
        const relevantIds = new Set(
          types
            .filter((t) =>
              t.is_seeded_default &&
              t.applicable_client_types.some((ct) => selectedClientTypes.has(ct as ClientType))
            )
            .map((t) => t.id)
        );
        setSelectedIds(relevantIds);
      }

      setIsLoading(false);
    })();
  }, [initialSelection, selectedClientTypes]);

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
          <h1 className="text-2xl font-bold tracking-tight">Choose your deadlines</h1>
          <p className="text-sm text-muted-foreground">
            Select the filing types you manage for your clients. The most common ones are
            pre-selected. You can change these at any time from your settings.
          </p>
        </div>

        <div className="space-y-5">
          {clientTypeGroups.map((group) => (
            <div key={group.clientType}>
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wide mb-1.5 px-1">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.filingTypes.map((ft) => (
                  <div
                    key={`${group.clientType}-${ft.id}`}
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
          ))}
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
          variant="blue"
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

// ─── Part 3: Document Requirements ────────────────────────────────────────────

function DocumentRequirementsPart({
  selectedIds,
  filingTypes,
  onComplete,
  onBack,
  initialDisabledDocuments,
}: {
  selectedIds: string[];
  filingTypes: FilingType[];
  onComplete: (selectedIds: string[], disabledDocs: string[]) => void;
  onBack: () => void;
  initialDisabledDocuments?: Set<string>;
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

      if (initialDisabledDocuments) {
        // Restore previous selections: all on except previously disabled
        const initial = new Set<string>();
        for (const [ftId, docs] of Object.entries(reqs)) {
          for (const doc of docs) {
            const key = `${ftId}::${doc.document_type_id}`;
            if (!initialDisabledDocuments.has(key)) {
              initial.add(key);
            }
          }
        }
        setEnabledDocs(initial);
      } else {
        // First visit: only enable mandatory documents
        const initial = new Set<string>();
        for (const [ftId, docs] of Object.entries(reqs)) {
          for (const doc of docs) {
            if (doc.is_mandatory) {
              initial.add(`${ftId}::${doc.document_type_id}`);
            }
          }
        }
        setEnabledDocs(initial);
      }
      setIsLoading(false);
    })();
  }, [selectedIds, initialDisabledDocuments]);

  const handleToggle = (filingTypeId: string, docTypeId: string, checked: boolean) => {
    const key = `${filingTypeId}::${docTypeId}`;
    setEnabledDocs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    // Build settings array — include all documents with their enabled state
    const settings: Array<{ filing_type_id: string; document_type_id: string; is_enabled: boolean }> = [];
    const disabledKeys: string[] = [];
    for (const [ftId, docs] of Object.entries(docRequirements)) {
      for (const doc of docs) {
        const key = `${ftId}::${doc.document_type_id}`;
        const isEnabled = enabledDocs.has(key);
        settings.push({
          filing_type_id: ftId,
          document_type_id: doc.document_type_id,
          is_enabled: isEnabled,
        });
        if (!isEnabled) disabledKeys.push(key);
      }
    }

    const result = await saveOrgDocumentSettings(settings);

    if (result.error) {
      setSaveError(result.error);
      setIsSaving(false);
      return;
    }

    onComplete(selectedIds, disabledKeys);
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

              return (
                <div key={ftId} className="rounded-lg border bg-muted/30 overflow-hidden">
                  {/* Filing type header — label only, no checkbox */}
                  <div className="px-4 py-2.5 bg-muted/50">
                    <span className="text-sm font-semibold">{nameMap.get(ftId)}</span>
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
  initialClientTypes,
  initialDisabledDocuments,
}: DeadlineSelectionStepProps) {
  const [part, setPart] = useState<1 | 2 | 3>(
    initialClientTypes && initialClientTypes.length > 0 ? 2 : 1
  );
  const [selectedClientTypes, setSelectedClientTypes] = useState<Set<ClientType>>(
    new Set((initialClientTypes ?? []) as ClientType[])
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection ?? []);
  const [filingTypes, setFilingTypes] = useState<FilingType[]>([]);
  const [disabledDocs, setDisabledDocs] = useState<Set<string>>(
    new Set(initialDisabledDocuments ?? [])
  );

  return (
    <>
      {part === 1 && (
        <ClientTypeSelectionPart
          initialClientTypes={selectedClientTypes.size > 0 ? selectedClientTypes : undefined}
          onBack={onBack}
          onContinue={(clientTypes) => {
            // If client types changed, clear stale deadline/doc selections
            const changed =
              clientTypes.size !== selectedClientTypes.size ||
              [...clientTypes].some((ct) => !selectedClientTypes.has(ct));
            if (changed) {
              setSelectedIds([]);
              setDisabledDocs(new Set());
            }
            setSelectedClientTypes(clientTypes);
            setPart(2);
          }}
        />
      )}

      {part === 2 && (
        <DeadlineSelectionPart
          selectedClientTypes={selectedClientTypes}
          initialSelection={selectedIds.length > 0 ? selectedIds : undefined}
          onBack={() => setPart(1)}
          onContinue={(ids, types) => {
            setSelectedIds(ids);
            setFilingTypes(types);
            // Clear stale disabled docs when deadline selection changes
            setDisabledDocs(new Set());
            setPart(3);
          }}
        />
      )}

      {part === 3 && (
        <DocumentRequirementsPart
          selectedIds={selectedIds}
          filingTypes={filingTypes}
          initialDisabledDocuments={disabledDocs.size > 0 ? disabledDocs : undefined}
          onComplete={(ids, disabledKeys) => {
            setDisabledDocs(new Set(disabledKeys));
            onComplete(ids, Array.from(selectedClientTypes), disabledKeys);
          }}
          onBack={() => setPart(2)}
        />
      )}
    </>
  );
}
