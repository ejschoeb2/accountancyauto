"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { TrafficLightStatus } from "@/lib/dashboard/traffic-light";
import { calculateFilingTypeStatus } from "@/lib/dashboard/traffic-light";
import type { FilingTypeStatus } from "@/lib/types/database";

interface UseClientProgressEditOptions {
  deadlineEditMode: 'status' | 'progress' | null;
  docRequirementsRef?: React.MutableRefObject<Record<string, Array<{ document_type_id: string; label: string; is_mandatory: boolean }>>>;
}

export function useClientProgressEdit({ deadlineEditMode }: UseClientProgressEditOptions) {
  // Document progress edit mode state
  const [docRequirements, setDocRequirements] = useState<
    Record<string, Array<{ document_type_id: string; label: string; is_mandatory: boolean }>>
  >({});
  const [manuallyReceivedMap, setManuallyReceivedMap] = useState<Record<string, Set<string>>>({});
  const orgIdRef = useRef<string | null>(null);

  // Fetch document requirements and manually received state when entering progress edit mode
  useEffect(() => {
    if (deadlineEditMode !== "progress") return;

    const supabase = createClient();

    const fetchProgressData = async () => {
      // Fetch org_id if not already cached
      if (!orgIdRef.current) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const id = user.app_metadata?.org_id;
        if (id) {
          orgIdRef.current = id;
        } else {
          const { data: membership } = await supabase
            .from("user_organisations")
            .select("org_id")
            .eq("user_id", user.id)
            .limit(1)
            .single();
          if (membership?.org_id) orgIdRef.current = membership.org_id;
        }
      }

      // Fetch mandatory document requirements for all filing types (with labels)
      const { data: reqs } = await supabase
        .from("filing_document_requirements")
        .select("filing_type_id, document_type_id, is_mandatory, document_types(label)")
        .eq("is_mandatory", true);

      const reqMap: Record<
        string,
        Array<{ document_type_id: string; label: string; is_mandatory: boolean }>
      > = {};
      for (const req of reqs ?? []) {
        if (!reqMap[req.filing_type_id]) reqMap[req.filing_type_id] = [];
        const docTypes = req.document_types as
          | { label: string }
          | { label: string }[]
          | null;
        const label = Array.isArray(docTypes)
          ? docTypes[0]?.label ?? req.document_type_id
          : docTypes?.label ?? req.document_type_id;
        reqMap[req.filing_type_id].push({
          document_type_id: req.document_type_id,
          label,
          is_mandatory: req.is_mandatory,
        });
      }
      setDocRequirements(reqMap);

      // Fetch all manually_received customisations
      const { data: manualRows } = await supabase
        .from("client_document_checklist_customisations")
        .select("client_id, filing_type_id, document_type_id")
        .eq("manually_received", true);

      // Also fetch uploaded documents (high/medium confidence)
      const { data: docRows } = await supabase
        .from("client_documents")
        .select("client_id, filing_type_id, document_type_id")
        .in("classification_confidence", ["high", "medium"]);

      const map: Record<string, Set<string>> = {};
      for (const row of [...(manualRows ?? []), ...(docRows ?? [])]) {
        if (!row.filing_type_id || !row.document_type_id) continue;
        const key = `${row.client_id}-${row.filing_type_id}`;
        if (!map[key]) map[key] = new Set();
        map[key].add(row.document_type_id);
      }
      setManuallyReceivedMap(map);
    };

    fetchProgressData();
  }, [deadlineEditMode]);

  // Handle document toggle in progress edit mode
  const handleDocumentToggle = useCallback(
    async (
      clientId: string,
      filingTypeId: string,
      documentTypeId: string,
      currentlyReceived: boolean,
      setLocalFilingStatusMap: React.Dispatch<React.SetStateAction<Record<string, FilingTypeStatus[]>>>
    ) => {
      const key = `${clientId}-${filingTypeId}`;
      const newValue = !currentlyReceived;

      // Optimistic update
      setManuallyReceivedMap((prev) => {
        const next = { ...prev };
        const set = new Set(next[key] ?? []);
        if (newValue) {
          set.add(documentTypeId);
        } else {
          set.delete(documentTypeId);
        }
        next[key] = set;
        return next;
      });

      const supabase = createClient();
      const orgId = orgIdRef.current;
      if (!orgId) {
        toast.error("Organisation not found");
        return;
      }

      const { error } = await supabase
        .from("client_document_checklist_customisations")
        .upsert(
          {
            org_id: orgId,
            client_id: clientId,
            filing_type_id: filingTypeId,
            document_type_id: documentTypeId,
            is_enabled: true,
            is_ad_hoc: false,
            manually_received: newValue,
          },
          { onConflict: "client_id,filing_type_id,document_type_id" }
        );

      if (error) {
        toast.error("Failed to update document status");
        // Revert optimistic update
        setManuallyReceivedMap((prev) => {
          const next = { ...prev };
          const set = new Set(next[key] ?? []);
          if (!newValue) set.add(documentTypeId);
          else set.delete(documentTypeId);
          next[key] = set;
          return next;
        });
        return;
      }

      // After successful toggle, check if all required docs for this filing type are now received
      // and update the local filing status accordingly
      const requirements = docRequirements[filingTypeId] ?? [];
      if (requirements.length === 0) return;

      // Build updated received set for this client+filing
      const updatedReceivedSet = new Set(manuallyReceivedMap[key] ?? []);
      if (newValue) {
        updatedReceivedSet.add(documentTypeId);
      } else {
        updatedReceivedSet.delete(documentTypeId);
      }

      const allDocsReceived = requirements.every((req) =>
        updatedReceivedSet.has(req.document_type_id)
      );
      const newDocReceivedCount = requirements.filter((req) =>
        updatedReceivedSet.has(req.document_type_id)
      ).length;

      // Update doc_received_count and status in local filing status map
      setLocalFilingStatusMap((prev) => {
        const next = { ...prev };
        const clientStatuses = [...(next[clientId] ?? [])];
        const idx = clientStatuses.findIndex((f) => f.filing_type_id === filingTypeId);
        if (idx >= 0) {
          const existing = clientStatuses[idx];
          const newStatus = calculateFilingTypeStatus({
            filing_type_id: filingTypeId,
            deadline_date: existing.deadline_date,
            is_records_received: allDocsReceived || existing.is_records_received,
            is_completed: false,
            override_status: existing.is_override
              ? (existing.status as TrafficLightStatus)
              : null,
          });
          clientStatuses[idx] = {
            ...existing,
            doc_received_count: newDocReceivedCount,
            is_records_received: allDocsReceived || existing.is_records_received,
            status: newStatus,
          };
          next[clientId] = clientStatuses;
        }
        return next;
      });

      // If all docs now received, update records_received_for on server
      if (allDocsReceived) {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("records_received_for")
          .eq("id", clientId)
          .single();

        const currentArray: string[] = clientRow?.records_received_for ?? [];
        if (!currentArray.includes(filingTypeId)) {
          await supabase
            .from("clients")
            .update({ records_received_for: [...currentArray, filingTypeId] })
            .eq("id", clientId)
            .eq("org_id", orgId);
        }

        // Cancel queued emails for this client+filing since records are now received
        await supabase
          .from("reminder_queue")
          .update({ status: "records_received" })
          .eq("client_id", clientId)
          .eq("filing_type_id", filingTypeId)
          .in("status", ["scheduled", "rescheduled"]);
      } else {
        // If unchecking made it no longer all received, remove from records_received_for
        const { data: clientRow } = await supabase
          .from("clients")
          .select("records_received_for")
          .eq("id", clientId)
          .single();

        const currentArray: string[] = clientRow?.records_received_for ?? [];
        if (currentArray.includes(filingTypeId)) {
          await supabase
            .from("clients")
            .update({
              records_received_for: currentArray.filter((id) => id !== filingTypeId),
            })
            .eq("id", clientId)
            .eq("org_id", orgId);

          // Restore queued emails that were cancelled due to records_received
          const todayStr = new Date().toISOString().split("T")[0];
          await supabase
            .from("reminder_queue")
            .update({ status: "scheduled" })
            .eq("client_id", clientId)
            .eq("filing_type_id", filingTypeId)
            .eq("status", "records_received")
            .gte("send_date", todayStr);

          // Also revert the local status
          setLocalFilingStatusMap((prev) => {
            const next = { ...prev };
            const clientStatuses = [...(next[clientId] ?? [])];
            const idx = clientStatuses.findIndex((f) => f.filing_type_id === filingTypeId);
            if (idx >= 0) {
              const existing = clientStatuses[idx];
              const newStatus = calculateFilingTypeStatus({
                filing_type_id: filingTypeId,
                deadline_date: existing.deadline_date,
                is_records_received: false,
                is_completed: false,
                override_status: existing.is_override
                  ? (existing.status as TrafficLightStatus)
                  : null,
              });
              clientStatuses[idx] = {
                ...existing,
                is_records_received: false,
                status: newStatus,
              };
              next[clientId] = clientStatuses;
            }
            return next;
          });
        }
      }
    },
    [docRequirements, manuallyReceivedMap]
  );

  return {
    docRequirements,
    manuallyReceivedMap,
    handleDocumentToggle,
  };
}
