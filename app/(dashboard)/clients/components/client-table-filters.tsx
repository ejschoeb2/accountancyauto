"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonWithText } from "@/components/ui/button-with-text";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { Card, CardContent } from "@/components/ui/card";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import {
  STATUS_LABELS,
  CLIENT_TYPE_OPTIONS,
  VAT_STAGGER_GROUP_OPTIONS,
} from "./use-client-table-filters";

// ---------- Reusable FilterDropdown (AUDIT-052) ----------
interface FilterDropdownProps {
  label: string;
  children: React.ReactNode;
}

export function FilterDropdown({ label, children }: FilterDropdownProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

// ---------- Search Bar ----------
interface SearchBarProps {
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
}

export function SearchBar({ globalFilter, setGlobalFilter }: SearchBarProps) {
  return (
    <div className="relative flex-1 max-w-sm">
      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search by client name..."
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="pl-9 hover:border-foreground/20"
      />
      {globalFilter && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={() => setGlobalFilter("")}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

// ---------- Filter Toggle Button ----------
interface FilterToggleProps {
  showFilters: boolean;
  setShowFilters: (fn: (v: boolean) => boolean) => void;
}

export function FilterToggle({ showFilters, setShowFilters }: FilterToggleProps) {
  return (
    <IconButtonWithText
      type="button"
      variant={showFilters ? "amber" : "violet"}
      onClick={() => setShowFilters((v) => !v)}
      title={showFilters ? "Close filters" : "Open filters"}
    >
      <SlidersHorizontal className="h-5 w-5" />
      {showFilters ? "Close Filters" : "Filter"}
    </IconButtonWithText>
  );
}

// ---------- Filter Panel ----------
interface FilterPanelProps {
  activeStatusFilters: Set<TrafficLightStatus>;
  toggleStatusFilter: (status: TrafficLightStatus) => void;
  activeTypeFilters: Set<string>;
  toggleTypeFilter: (type: string) => void;
  activeVatFilter: string | null;
  toggleVatFilter: (value: string) => void;
  activeVatStaggerFilters: Set<string>;
  toggleVatStaggerFilter: (stagger: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  clearAllFilters: () => void;
}

export function FilterPanel({
  activeStatusFilters,
  toggleStatusFilter,
  activeTypeFilters,
  toggleTypeFilter,
  activeVatFilter,
  toggleVatFilter,
  activeVatStaggerFilters,
  toggleVatStaggerFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  clearAllFilters,
}: FilterPanelProps) {
  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Status and Clear Filters */}
        <div className="flex items-start justify-between gap-4">
          <FilterDropdown label="Status">
            {(["red", "orange", "amber", "blue", "violet", "green", "grey"] as const).map(
              (status) => (
                <ButtonWithText
                  key={status}
                  onClick={() => toggleStatusFilter(status)}
                  isSelected={activeStatusFilters.has(status)}
                  variant="muted"
                >
                  {STATUS_LABELS[status]}
                </ButtonWithText>
              )
            )}
          </FilterDropdown>
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">
              Clear
            </span>
            <IconButtonWithText
              type="button"
              variant="destructive"
              onClick={clearAllFilters}
              title="Clear all filters"
            >
              <X className="h-5 w-5" />
              Clear all filters
            </IconButtonWithText>
          </div>
        </div>

        {/* Client Type */}
        <FilterDropdown label="Client Type">
          {CLIENT_TYPE_OPTIONS.map((opt) => (
            <ButtonWithText
              key={opt.value}
              onClick={() => toggleTypeFilter(opt.value)}
              isSelected={activeTypeFilters.has(opt.value)}
              variant="muted"
            >
              {opt.label}
            </ButtonWithText>
          ))}
        </FilterDropdown>

        {/* VAT Status */}
        <FilterDropdown label="VAT Status">
          <ButtonWithText
            onClick={() => toggleVatFilter("vat")}
            isSelected={activeVatFilter === "vat"}
            variant="muted"
          >
            VAT Registered
          </ButtonWithText>
          <ButtonWithText
            onClick={() => toggleVatFilter("no-vat")}
            isSelected={activeVatFilter === "no-vat"}
            variant="muted"
          >
            Not VAT Registered
          </ButtonWithText>
        </FilterDropdown>

        {/* VAT Stagger Group */}
        <FilterDropdown label="VAT Stagger Group">
          {VAT_STAGGER_GROUP_OPTIONS.map((opt) => (
            <ButtonWithText
              key={opt.value}
              onClick={() => toggleVatStaggerFilter(opt.value)}
              isSelected={activeVatStaggerFilters.has(opt.value)}
              variant="muted"
            >
              {opt.label}
            </ButtonWithText>
          ))}
        </FilterDropdown>

        {/* Next Deadline Date Range Filter */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Next Deadline Date Range
          </span>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From:</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40 hover:border-foreground/20"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To:</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40 hover:border-foreground/20"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
