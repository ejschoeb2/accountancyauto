"use client";

import { useState, useMemo, useEffect } from "react";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import type { Client } from "@/app/actions/clients";
import type { ClientStatusInfo } from "./client-table";

// Sort option labels
export const SORT_LABELS: Record<string, string> = {
  "name-asc": "Name (A-Z)",
  "name-desc": "Name (Z-A)",
  "deadline-asc": "Deadline (Earliest)",
  "deadline-desc": "Deadline (Latest)",
  "type-asc": "Type (A-Z)",
};

// Status filter config
export const STATUS_LABELS: Record<TrafficLightStatus, string> = {
  red: "Overdue",
  orange: "Critical",
  amber: "Approaching",
  blue: "On Track",
  violet: "Records Received",
  green: "Completed",
  grey: "Inactive",
};

// Client type options
export const CLIENT_TYPE_OPTIONS = [
  { value: "Limited Company", label: "Limited Company" },
  { value: "Partnership", label: "Partnership" },
  { value: "LLP", label: "LLP" },
  { value: "Individual", label: "Individual" },
];

// VAT stagger group options
export const VAT_STAGGER_GROUP_OPTIONS = [
  { value: "1", label: "Stagger 1 (Mar/Jun/Sep/Dec)" },
  { value: "2", label: "Stagger 2 (Jan/Apr/Jul/Oct)" },
  { value: "3", label: "Stagger 3 (Feb/May/Aug/Nov)" },
];

export type ViewMode = 'data' | 'status';

interface UseClientTableFiltersOptions {
  data: Client[];
  localStatusMap: Record<string, ClientStatusInfo>;
  initialFilter?: string;
  initialSort?: string;
  initialView?: ViewMode;
  viewMode: ViewMode;
  deadlineClientType: string;
  setDeadlineClientType: (type: string) => void;
}

export function useClientTableFilters({
  data,
  localStatusMap,
  initialFilter,
  initialSort,
  viewMode,
  deadlineClientType,
  setDeadlineClientType,
}: UseClientTableFiltersOptions) {
  // Initialize filters based on initialFilter parameter
  const getInitialStatusFilters = () => {
    const validStatuses: TrafficLightStatus[] = ['red', 'orange', 'amber', 'blue', 'violet', 'green', 'grey'];
    if (initialFilter && validStatuses.includes(initialFilter as TrafficLightStatus)) {
      return new Set<TrafficLightStatus>([initialFilter as TrafficLightStatus]);
    }
    return new Set<TrafficLightStatus>();
  };

  const validSorts = Object.keys(SORT_LABELS);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sortBy, setSortBy] = useState<string>(
    initialSort && validSorts.includes(initialSort) ? initialSort : "deadline-asc"
  );
  const [activeTypeFilters, setActiveTypeFilters] = useState<Set<string>>(new Set());
  const [activeVatFilter, setActiveVatFilter] = useState<string | null>(null);
  const [activeVatStaggerFilters, setActiveVatStaggerFilters] = useState<Set<string>>(new Set());
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<TrafficLightStatus>>(getInitialStatusFilters());
  const [pausedFilter, setPausedFilter] = useState<boolean>(initialFilter === "paused");
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(initialFilter ? true : false);

  function toggleStatusFilter(status: TrafficLightStatus) {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  function toggleTypeFilter(type: string) {
    setActiveTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleVatFilter(value: string) {
    setActiveVatFilter((prev) => (prev === value ? null : value));
  }

  function toggleVatStaggerFilter(stagger: string) {
    setActiveVatStaggerFilters((prev) => {
      const next = new Set(prev);
      if (next.has(stagger)) {
        next.delete(stagger);
      } else {
        next.add(stagger);
      }
      return next;
    });
  }

  function clearAllFilters() {
    setActiveTypeFilters(new Set());
    setActiveVatFilter(null);
    setActiveVatStaggerFilters(new Set());
    setActiveStatusFilters(new Set());
    setPausedFilter(false);
    setDateFrom('');
    setDateTo('');
  }

  const activeFilterCount =
    activeTypeFilters.size +
    (activeVatFilter ? 1 : 0) +
    activeVatStaggerFilters.size +
    activeStatusFilters.size +
    (pausedFilter ? 1 : 0);

  // Filter and sort data based on tag filters + status filter + sort option
  const filteredData = useMemo(() => {
    // Apply name search first so it takes priority over all other filters
    let pool = data;
    if (globalFilter) {
      const search = globalFilter.toLowerCase();
      pool = data.filter((client) => {
        const name = (client.display_name || client.company_name || "").toLowerCase();
        const company = (client.company_name || "").toLowerCase();
        return name.includes(search) || company.includes(search);
      });
    }

    let filtered = pool.filter((client) => {
      // In deadline view, filter by selected client type — but skip when
      // searching so results aren't hidden by the wrong tab
      if (viewMode === 'status' && !globalFilter && client.client_type !== deadlineClientType) {
        return false;
      }
      // Paused filter
      if (pausedFilter && !client.reminders_paused) {
        return false;
      }
      // Client type filter
      if (activeTypeFilters.size > 0 && (!client.client_type || !activeTypeFilters.has(client.client_type))) {
        return false;
      }
      // VAT status filter
      if (activeVatFilter === "vat" && !client.vat_registered) {
        return false;
      }
      if (activeVatFilter === "no-vat" && client.vat_registered) {
        return false;
      }
      // VAT stagger filter
      if (activeVatStaggerFilters.size > 0) {
        if (!client.vat_stagger_group || !activeVatStaggerFilters.has(client.vat_stagger_group.toString())) {
          return false;
        }
      }
      // Traffic light status filter
      if (activeStatusFilters.size > 0) {
        const clientStatus = localStatusMap[client.id]?.status as TrafficLightStatus | undefined;
        if (!clientStatus || !activeStatusFilters.has(clientStatus)) {
          return false;
        }
      }
      // Date range filter for next deadline
      if (dateFrom || dateTo) {
        const nextDeadline = localStatusMap[client.id]?.next_deadline;
        if (!nextDeadline) return false;

        const deadlineDate = nextDeadline.split('T')[0]; // Get just the date part

        if (dateFrom && deadlineDate < dateFrom) {
          return false;
        }

        if (dateTo && deadlineDate > dateTo) {
          return false;
        }
      }
      return true;
    });

    // Apply sorting based on sortBy value
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.display_name || a.company_name).localeCompare(b.display_name || b.company_name);
        case "name-desc":
          return (b.display_name || b.company_name).localeCompare(a.display_name || a.company_name);
        case "deadline-asc": {
          const deadlineA = localStatusMap[a.id]?.next_deadline;
          const deadlineB = localStatusMap[b.id]?.next_deadline;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return 1;
          if (!deadlineB) return -1;
          return deadlineA.localeCompare(deadlineB);
        }
        case "deadline-desc": {
          const deadlineA = localStatusMap[a.id]?.next_deadline;
          const deadlineB = localStatusMap[b.id]?.next_deadline;
          if (!deadlineA && !deadlineB) return 0;
          if (!deadlineA) return -1;
          if (!deadlineB) return 1;
          return deadlineB.localeCompare(deadlineA);
        }
        case "type-asc":
          return (a.client_type || "").localeCompare(b.client_type || "");
        default:
          return 0;
      }
    });

    return sorted;
  }, [data, viewMode, deadlineClientType, globalFilter, activeTypeFilters, activeVatFilter, activeVatStaggerFilters, activeStatusFilters, pausedFilter, localStatusMap, sortBy, dateFrom, dateTo]);

  // Auto-switch client type tab when searching in status view
  // If the search matches clients of a single type, switch to that type tab
  useEffect(() => {
    if (viewMode !== 'status' || !globalFilter) return;

    const search = globalFilter.toLowerCase();
    const matchingTypes = new Set<string>();

    for (const client of data) {
      const name = (client.display_name || client.company_name || "").toLowerCase();
      const company = (client.company_name || "").toLowerCase();
      if (name.includes(search) || company.includes(search)) {
        if (client.client_type) matchingTypes.add(client.client_type);
      }
    }

    // If all matches are a single type and it's different from current, switch
    if (matchingTypes.size === 1) {
      const matchedType = [...matchingTypes][0];
      if (matchedType !== deadlineClientType) {
        setDeadlineClientType(matchedType);
      }
    }
  }, [globalFilter, viewMode, data, deadlineClientType, setDeadlineClientType]);

  return {
    globalFilter,
    setGlobalFilter,
    sortBy,
    setSortBy,
    activeTypeFilters,
    activeVatFilter,
    activeVatStaggerFilters,
    activeStatusFilters,
    pausedFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    showFilters,
    setShowFilters,
    toggleStatusFilter,
    toggleTypeFilter,
    toggleVatFilter,
    toggleVatStaggerFilter,
    clearAllFilters,
    activeFilterCount,
    filteredData,
  };
}
