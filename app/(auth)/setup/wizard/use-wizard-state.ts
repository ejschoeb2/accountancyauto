"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/stripe/plans";
import type { UploadCheckMode } from "@/app/actions/settings";
import type { EditableRow } from "./components/csv-import-step";
import type { StepState as EmailSubStep } from "./components/email-setup-step";
import type { AdminStep, UserType } from "./wizard-steps";
import { PLAN_TIERS, slugifyFirmName } from "./wizard-steps";
import {
  checkSlugAvailable,
  createOrgAndJoinAsAdmin,
  finaliseWizardSetup,
  getDraftClients,
  getSetupDraft,
  getWizardDashboardUrl,
  getWizardOrgId,
  saveDraftClients,
  saveSetupDraft,
  updateOrgPlanTier,
  type SetupDraft,
} from "./actions";
import {
  markMemberSetupComplete,
  getUserSendHour,
  getUserEmailSettings,
  getPostmarkSettings,
  type EmailSettings,
} from "@/app/actions/settings";
import { logger } from "@/lib/logger";

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWizardState() {
  const supabase = createClient();
  const router = useRouter();

  // ── Auth detection ──────────────────────────────────────────────────────────
  const [userType, setUserType] = useState<UserType>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ── Admin step ──────────────────────────────────────────────────────────────
  const [adminStep, setAdminStep] = useState<AdminStep>("firm");
  const [isJoiningExistingOrg, setIsJoiningExistingOrg] = useState(false);

  // ── Member step (0=Import, 1=Config, 2=Complete) ───────────────────────────
  const [memberStep, setMemberStep] = useState(0);

  // ── Firm Details ────────────────────────────────────────────────────────────
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [slugReason, setSlugReason] = useState<string | null>(null);
  const [firmError, setFirmError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Plan ────────────────────────────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgCreated, setOrgCreated] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  // ── Import ──────────────────────────────────────────────────────────────────
  const [savedImportRows, setSavedImportRows] = useState<EditableRow[] | null>(
    null
  );

  // ── Config defaults ─────────────────────────────────────────────────────────
  const [sendHour, setSendHour] = useState<number | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(
    null
  );
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // ── Postmark ────────────────────────────────────────────────────────────────
  const [orgDomain, setOrgDomain] = useState<string | undefined>(undefined);

  // ── Client portal ──────────────────────────────────────────────────────────
  const [clientPortalEnabled, setClientPortalEnabled] = useState(true);
  const [portalSubStep, setPortalSubStep] = useState<1 | 2 | 3 | undefined>(
    undefined
  );
  const [portalSelection, setPortalSelection] = useState<
    "yes" | "no" | undefined
  >(undefined);

  // ── Deadline selections ────────────────────────────────────────────────────
  const [deadlineSelections, setDeadlineSelections] = useState<
    string[] | undefined
  >(undefined);
  const [selectedClientTypes, setSelectedClientTypes] = useState<
    string[] | undefined
  >(undefined);
  const [disabledDocuments, setDisabledDocuments] = useState<
    string[] | undefined
  >(undefined);

  // ── Upload checks ──────────────────────────────────────────────────────────
  const [uploadCheckSelection, setUploadCheckSelection] = useState<
    UploadCheckMode | undefined
  >(undefined);
  const [autoReceiveSelection, setAutoReceiveSelection] = useState(false);
  const [rejectMismatchedSelection, setRejectMismatchedSelection] =
    useState(false);

  // ── Storage ─────────────────────────────────────────────────────────────────
  const [storageConnected, setStorageConnected] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [emailInitialSubStep, setEmailInitialSubStep] =
    useState<EmailSubStep>("input");

  // ── Complete step ──────────────────────────────────────────────────────────
  const [dashboardUrl, setDashboardUrl] = useState("/dashboard");
  const [isLeavingWizard, setIsLeavingWizard] = useState(false);
  const isNavigatingAway = useRef(false);

  // ── Guard against accidental unload (only for pre-org steps) ──────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNavigatingAway.current) return;
      if (orgCreated) return;
      e.preventDefault();
      e.returnValue =
        "You haven't completed setup yet. Are you sure you want to leave?";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgCreated]);

  // ── Helper: hydrate component state from a DB draft ───────────────────────
  function hydrateFromDraft(draft: SetupDraft | null, overrideStep?: AdminStep) {
    if (!draft) return;
    setAdminStep(overrideStep ?? (draft.step as AdminStep));
    if (draft.firmName) setFirmName(draft.firmName);
    if (draft.firmSlug) setSlug(draft.firmSlug);
    if (draft.selectedTier) setSelectedTier(draft.selectedTier as PlanTier);
    if (draft.orgId) setOrgId(draft.orgId);
    if (draft.portalEnabled !== undefined)
      setClientPortalEnabled(draft.portalEnabled);
    if (draft.uploadCheckMode)
      setUploadCheckSelection(draft.uploadCheckMode as UploadCheckMode);
    if (draft.autoReceiveVerified !== undefined)
      setAutoReceiveSelection(draft.autoReceiveVerified);
    if (draft.rejectMismatchedUploads !== undefined)
      setRejectMismatchedSelection(draft.rejectMismatchedUploads);
    if (draft.sendHour !== undefined) setSendHour(draft.sendHour);
    if (draft.emailSubStep)
      setEmailInitialSubStep(draft.emailSubStep as EmailSubStep);
    if (draft.deadlineSelections)
      setDeadlineSelections(draft.deadlineSelections);
    if (draft.selectedClientTypes)
      setSelectedClientTypes(draft.selectedClientTypes);
    if (draft.disabledDocuments) setDisabledDocuments(draft.disabledDocuments);
    if (draft.joiningExistingOrg) setIsJoiningExistingOrg(true);
    if (draft.portalSubStep)
      setPortalSubStep(draft.portalSubStep as 1 | 2 | 3);
    setOrgCreated(true);
  }

  // ── Helper: collect current component state into a draft object ───────────
  function collectCurrentState(): SetupDraft {
    return {
      step: adminStep,
      firmName,
      firmSlug: slug,
      selectedTier: selectedTier ?? undefined,
      portalEnabled: clientPortalEnabled,
      uploadCheckMode: uploadCheckSelection,
      autoReceiveVerified: autoReceiveSelection,
      rejectMismatchedUploads: rejectMismatchedSelection,
      emailSubStep: emailInitialSubStep,
      sendHour: sendHour ?? undefined,
      deadlineSelections,
      selectedClientTypes,
      disabledDocuments,
      joiningExistingOrg: isJoiningExistingOrg || undefined,
      portalSubStep,
      updatedAt: new Date().toISOString(),
    };
  }

  // ── Wrapper: save draft to DB then advance step ───────────────────────────
  function advanceToStep(nextStep: AdminStep) {
    if (orgCreated && nextStep !== "complete") {
      const draft = collectCurrentState();
      draft.step = nextStep;
      saveSetupDraft(draft).catch((e) =>
        logger.warn("Draft save failed:", e)
      );
    }
    setAdminStep(nextStep);
  }

  // ── Prefetch config defaults ──────────────────────────────────────────────
  function prefetchConfigDefaults() {
    Promise.all([
      getUserSendHour(),
      getUserEmailSettings(),
      getPostmarkSettings(),
    ]).then(([hour, settings, postmark]) => {
      setSendHour(hour);
      setEmailSettings(settings);
      if (postmark.senderDomain) setOrgDomain(postmark.senderDomain);
    });
  }

  // ── On mount: detect user type and starting step ──────────────────────────
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        const pendingEmail = sessionStorage.getItem("wizard_pending_email");
        if (pendingEmail) {
          setAdminStep("account");
          setUserType("new-admin");
          setIsCheckingAuth(false);
          return;
        }
        await supabase.auth.signOut();
        router.replace("/signup");
        return;
      }

      // Refresh session on external return
      const urlParams = new URLSearchParams(window.location.search);
      const hasReturnParams =
        urlParams.has("from") ||
        urlParams.has("storage_connected") ||
        urlParams.has("storage_error");
      if (hasReturnParams) {
        await supabase.auth.refreshSession();
      }

      const sc = urlParams.get("storage_connected");
      const se = urlParams.get("storage_error");
      const fromStripe = urlParams.get("from") === "stripe";
      const fromStripeComplete = urlParams.get("from") === "stripe-complete";

      // Clean URL params
      if (sc || se || fromStripe || fromStripeComplete) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      // Handle Stripe return from complete step
      if (fromStripeComplete) {
        const url = await getWizardDashboardUrl();
        isNavigatingAway.current = true;
        window.location.href = url;
        return;
      }

      // Handle Stripe return (plan-step flow)
      if (fromStripe) {
        const draft = await getSetupDraft();
        setUserType("new-admin");
        if (draft) {
          hydrateFromDraft(draft, "deadlines");
        } else {
          setAdminStep("deadlines");
          setOrgCreated(true);
          const fallbackOrgId = await getWizardOrgId();
          if (fallbackOrgId) setOrgId(fallbackOrgId);
        }
        const draftClients = await getDraftClients();
        if (draftClients && draftClients.length > 0) {
          setSavedImportRows(draftClients);
        }
        prefetchConfigDefaults();
      }
      // Handle storage OAuth return
      else if (sc || se) {
        const draft = await getSetupDraft();
        setUserType("new-admin");
        if (draft) {
          hydrateFromDraft(draft, "portal");
        } else {
          setAdminStep("portal");
          setOrgCreated(true);
          const fallbackOrgId = await getWizardOrgId();
          if (fallbackOrgId) setOrgId(fallbackOrgId);
        }
        const draftClients = await getDraftClients();
        if (draftClients && draftClients.length > 0) {
          setSavedImportRows(draftClients);
        }
        setStorageConnected(sc);
        setStorageError(se);
        const url = await getWizardDashboardUrl();
        setDashboardUrl(url);
      }
      // No external return — check for DB draft or org membership
      else {
        await supabase.auth.refreshSession();

        const draft = await getSetupDraft();
        if (draft) {
          setUserType("new-admin");
          hydrateFromDraft(draft);
          const draftClients = await getDraftClients();
          if (draftClients && draftClients.length > 0) {
            setSavedImportRows(draftClients);
          }
          if (
            ["deadlines", "import", "email", "portal", "complete"].includes(
              draft.step
            )
          ) {
            prefetchConfigDefaults();
          }
          if (draft.step === "complete") {
            const url = await getWizardDashboardUrl();
            setDashboardUrl(url);
          }
        } else {
          const { data: userOrg } = await supabase
            .from("user_organisations")
            .select("org_id, role")
            .eq("user_id", user.id)
            .limit(1)
            .maybeSingle();

          if (!userOrg?.org_id) {
            setUserType("new-admin");
            setAdminStep("firm");
          } else if (userOrg.role === "admin") {
            setUserType("new-admin");
            setOrgCreated(true);
            setOrgId(userOrg.org_id);
            setIsJoiningExistingOrg(true);
            setEmailInitialSubStep("settings");
            setAdminStep("deadlines");
            prefetchConfigDefaults();
          } else {
            setUserType("invited-member");
            setMemberStep(0);
            prefetchConfigDefaults();
          }
        }
      }

      setIsCheckingAuth(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Slug availability check ───────────────────────────────────────────────
  const checkSlug = useCallback((value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || value.length < 1) {
      setSlugStatus("idle");
      setSlugReason(null);
      return;
    }

    setSlugStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const result = await checkSlugAvailable(value);
      setSlugStatus(result.available ? "available" : "unavailable");
      setSlugReason(result.reason ?? null);
    }, 500);
  }, []);

  const handleFirmNameChange = (value: string) => {
    setFirmName(value);
    const suggested = slugifyFirmName(value);
    setSlug(suggested);
    checkSlug(suggested);
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    checkSlug(value);
  };

  // ── Step handlers ─────────────────────────────────────────────────────────

  const handleAccountComplete = () => {
    sessionStorage.removeItem("wizard_pending_email");
    setAdminStep("firm");
  };

  const handleFirmContinue = () => {
    if (!firmName.trim()) {
      setFirmError("Please enter your firm name.");
      return;
    }
    if (slugStatus !== "available") {
      setFirmError("Please choose an available URL slug.");
      return;
    }
    setFirmError(null);
    setAdminStep("plan");
  };

  const handleSelectPlan = async (tier: PlanTier) => {
    setSelectedTier(tier);
    setIsCreatingOrg(true);
    setPlanError(null);

    try {
      const result = await createOrgAndJoinAsAdmin(firmName, slug, tier);
      setOrgId(result.orgId);
      await supabase.auth.refreshSession();
      await updateOrgPlanTier(tier);
      prefetchConfigDefaults();
      setOrgCreated(true);
      setIsCreatingOrg(false);
      setAdminStep("deadlines");
      saveSetupDraft({
        step: "deadlines",
        firmName,
        firmSlug: slug,
        selectedTier: tier,
        updatedAt: new Date().toISOString(),
      }).catch((e) => logger.warn("Draft save failed:", e));
    } catch (err) {
      setPlanError(
        err instanceof Error
          ? err.message
          : "Failed to create organisation. Please try again."
      );
      setSelectedTier(null);
      setIsCreatingOrg(false);
    }
  };

  const handlePlanNext = async () => {
    if (!selectedTier) return;

    if (orgCreated) {
      setIsCreatingOrg(true);
      setPlanError(null);
      try {
        await updateOrgPlanTier(selectedTier);
        setIsCreatingOrg(false);
        advanceToStep("deadlines");
      } catch (err) {
        setPlanError(
          err instanceof Error
            ? err.message
            : "Failed to update plan. Please try again."
        );
        setIsCreatingOrg(false);
      }
      return;
    }

    handleSelectPlan(selectedTier);
  };

  const handleImportComplete = () => {
    if (userType === "new-admin") {
      advanceToStep("email");
    } else {
      setMemberStep(1);
    }
    if (sendHour === null) {
      prefetchConfigDefaults();
    }
  };

  const handleConfigComplete = async () => {
    setIsCompleting(true);
    setCompleteError(null);

    if (userType === "invited-member") {
      const result = await markMemberSetupComplete();
      if (result.error) {
        setCompleteError(result.error);
        setIsCompleting(false);
        return;
      }
    }

    fetch("/api/reminders/rebuild-queue", { method: "POST" }).catch(() => {});

    await supabase.auth.refreshSession();
    const url = await getWizardDashboardUrl();

    setDashboardUrl(url);
    setIsCompleting(false);
    prefetchConfigDefaults();
    setEmailInitialSubStep("settings");

    if (userType === "new-admin") {
      advanceToStep("portal");
    } else {
      setMemberStep(2);
    }
  };

  const handleGoToDashboard = async () => {
    setIsLeavingWizard(true);
    setCompleteError(null);

    try {
      const result = await finaliseWizardSetup(clientPortalEnabled);
      if (result.error) {
        logger.error("finaliseWizardSetup returned error", {
          error: String(result.error),
        });
        setCompleteError(
          "Something went wrong finalising your setup. Please try again."
        );
        setIsLeavingWizard(false);
        return;
      }
    } catch (err) {
      logger.error("handleGoToDashboard setup error:", {
        error: (err as any)?.message ?? String(err),
      });
      setCompleteError(
        "Something went wrong finalising your setup. Please try again."
      );
      setIsLeavingWizard(false);
      return;
    }

    if (selectedTier && selectedTier !== "free") {
      if (!orgId) {
        setCompleteError(
          "Organisation not found. Please refresh and try again."
        );
        setIsLeavingWizard(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planTier: selectedTier,
            orgId,
            successUrl: "/setup/wizard?from=stripe-complete",
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        if (!response.ok) {
          setCompleteError(
            data.error || "Failed to start checkout. Please try again."
          );
          setIsLeavingWizard(false);
          return;
        }
        if (data.url) {
          isNavigatingAway.current = true;
          window.location.href = data.url;
        } else {
          setCompleteError(
            "Checkout session created but no redirect URL. Please try again."
          );
          setIsLeavingWizard(false);
        }
      } catch (err) {
        const message =
          err instanceof DOMException && err.name === "AbortError"
            ? "Checkout request timed out. Please try again."
            : "Failed to start checkout. Please try again.";
        setCompleteError(message);
        setIsLeavingWizard(false);
      }
    } else {
      isNavigatingAway.current = true;
      window.location.href = dashboardUrl;
    }
  };

  const handleDeadlinesComplete = (
    selectedIds: string[],
    clientTypes: string[],
    disabledDocs: string[]
  ) => {
    setDeadlineSelections(selectedIds);
    setSelectedClientTypes(clientTypes);
    setDisabledDocuments(disabledDocs);
    const nextStep = "import" as AdminStep;
    saveSetupDraft({
      ...collectCurrentState(),
      step: nextStep,
      deadlineSelections: selectedIds,
      selectedClientTypes: clientTypes,
      disabledDocuments: disabledDocs,
      updatedAt: new Date().toISOString(),
    }).catch((e) => logger.warn("Draft save failed:", e));
    setAdminStep(nextStep);
  };

  const handlePortalComplete = (enabled: boolean) => {
    setClientPortalEnabled(enabled);
    setPortalSelection(enabled ? "yes" : "no");
    setPortalSubStep(undefined);
    setAdminStep("complete");
  };

  const handleBeforeStorageConnect = async () => {
    isNavigatingAway.current = true;
    setPortalSubStep(2);
    const draft = collectCurrentState();
    draft.step = "portal";
    draft.portalSubStep = 2;
    await saveSetupDraft(draft);
  };

  const handleImportRowsChange = (rows: EditableRow[] | null) => {
    setSavedImportRows(rows);
    if (orgCreated && rows) {
      saveDraftClients(rows).catch((e) =>
        logger.warn("Draft clients save failed:", e)
      );
    }
  };

  const handleStepperClick = (index: number) => {
    if (isJoiningExistingOrg) {
      const stepIds = ["deadlines", "import", "email", "complete"] as AdminStep[];
      advanceToStep(stepIds[index]);
      return;
    }
    // Verify Email step (0) is always locked
    if (index === 0) return;
    // Firm step (1) is locked once the org is created
    if (index === 1 && orgCreated) return;
    const stepIds: AdminStep[] = [
      "account",
      "firm",
      "plan",
      "deadlines",
      "import",
      "email",
      "portal",
      "complete",
    ];
    advanceToStep(stepIds[index]);
  };

  return {
    // Auth
    userType,
    isCheckingAuth,

    // Steps
    adminStep,
    memberStep,
    setMemberStep,
    isJoiningExistingOrg,

    // Firm
    firmName,
    slug,
    slugStatus,
    slugReason,
    firmError,
    handleFirmNameChange,
    handleSlugChange,

    // Plan
    selectedTier,
    setSelectedTier,
    isCreatingOrg,
    orgCreated,
    planError,
    setPlanError,
    orgId,

    // Import
    savedImportRows,
    handleImportRowsChange,
    selectedClientTypes,

    // Config
    sendHour,
    emailSettings,
    isCompleting,
    completeError,
    orgDomain,

    // Portal
    clientPortalEnabled,
    portalSubStep,
    portalSelection,
    uploadCheckSelection,
    autoReceiveSelection,
    rejectMismatchedSelection,
    storageConnected,
    storageError,

    // Email
    emailInitialSubStep,

    // Deadline
    deadlineSelections,
    disabledDocuments,

    // Complete
    dashboardUrl,
    isLeavingWizard,

    // Handlers
    advanceToStep,
    handleAccountComplete,
    handleFirmContinue,
    handlePlanNext,
    handleImportComplete,
    handleConfigComplete,
    handleGoToDashboard,
    handleDeadlinesComplete,
    handlePortalComplete,
    handleBeforeStorageConnect,
    handleStepperClick,
  };
}
