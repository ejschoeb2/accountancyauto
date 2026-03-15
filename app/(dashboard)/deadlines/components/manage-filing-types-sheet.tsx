"use client";

import { useState, useTransition } from "react";
import { Settings2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { updateOrgFilingTypeSelections } from "@/app/actions/deadlines";

interface FilingTypeEntry {
  id: string;
  name: string;
  description: string | null;
  is_seeded_default?: boolean;
  calculator_type?: string;
}

interface ManageFilingTypesSheetProps {
  allFilingTypes: FilingTypeEntry[];
  activeTypeIds: string[];
}

// Filing type category groupings — mirrors the wizard step
const CATEGORY_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: "Company Deadlines",
    ids: [
      "corporation_tax_payment",
      "ct600_filing",
      "companies_house",
      "confirmation_statement",
    ],
  },
  {
    label: "VAT & MTD",
    ids: ["vat_return", "mtd_quarterly_update"],
  },
  {
    label: "Personal Tax",
    ids: [
      "self_assessment",
      "sa_payment_on_account",
      "partnership_tax_return",
      "trust_tax_return",
    ],
  },
  {
    label: "Payroll & Employment",
    ids: [
      "p11d_filing",
      "paye_monthly",
      "cis_monthly_return",
      "payroll_year_end",
    ],
  },
];

export function ManageFilingTypesSheet({
  allFilingTypes,
  activeTypeIds,
}: ManageFilingTypesSheetProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(activeTypeIds)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset selection state when sheet opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelected(new Set(activeTypeIds));
      setError(null);
    }
    setOpen(isOpen);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateOrgFilingTypeSelections(Array.from(selected));
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  };

  // Build lookup for quick name/desc access
  const typeMap = new Map(allFilingTypes.map((ft) => [ft.id, ft]));

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Manage Filing Types
        </Button>
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle>Manage Filing Types</SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which filing types appear on the Deadlines page. Only active
            types will show reminders and deadline cards.
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {CATEGORY_GROUPS.map((group) => {
            const groupTypes = group.ids
              .map((id) => typeMap.get(id))
              .filter((ft): ft is FilingTypeEntry => !!ft);

            if (groupTypes.length === 0) return null;

            return (
              <div key={group.label} className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {groupTypes.map((ft) => (
                    <label
                      key={ft.id}
                      className="flex items-start gap-3 cursor-pointer group"
                    >
                      <Checkbox
                        checked={selected.has(ft.id)}
                        onCheckedChange={() => toggle(ft.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">
                          {ft.name}
                        </p>
                        {ft.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ft.description}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t px-6 py-4 space-y-3">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
