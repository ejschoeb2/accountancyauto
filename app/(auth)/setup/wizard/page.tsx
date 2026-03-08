"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonBase } from "@/components/ui/button-base";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { WizardStepper } from "@/components/wizard-stepper";
import { CsvImportStep, type EditableRow } from "./components/csv-import-step";
import { ConfigStep } from "./components/config-step";
import { EmailSetupStep, type StepState as EmailSubStep } from "./components/email-setup-step";
import { StorageSetupStep } from "./components/storage-setup-step";
import { ClientPortalStep } from "./components/client-portal-step";
import { UploadChecksStep } from "./components/upload-checks-step";
import { AccountSetupStep } from "./components/account-setup-step";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/stripe/plans";
import type { UploadCheckMode } from "@/app/actions/settings";
import {
  checkSlugAvailable,
  createOrgAndJoinAsAdmin,
  getWizardDashboardUrl,
  markOrgSetupComplete,
  refreshWizardSession,
  seedOrgDefaultsForWizard,
} from "./actions";
import {
  markMemberSetupComplete,
  getUserSendHour,
  getUserEmailSettings,
  getPostmarkSettings,
  type EmailSettings,
} from "@/app/actions/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserType = "new-admin" | "invited-member" | null;

// New-admin step names (index matches ADMIN_STEPS position)
type AdminStep = "account" | "firm" | "plan" | "import" | "email" | "portal" | "upload-checks" | "storage" | "complete";

// ─── Step arrays ──────────────────────────────────────────────────────────────

function getAdminSteps(portalEnabled: boolean) {
  const steps = [
    { label: "Verify Email" },
    { label: "Firm Details" },
    { label: "Plan" },
    { label: "Import Clients" },
    { label: "Email Setup" },
    { label: "Client Portal" },
  ];
  if (portalEnabled) {
    steps.push({ label: "Upload Checks" });
    steps.push({ label: "Storage" });
  }
  steps.push({ label: "Complete" });
  return steps;
}

function adminStepToIndex(step: AdminStep, portalEnabled: boolean): number {
  if (portalEnabled) {
    const map: Record<AdminStep, number> = {
      account: 0,
      firm: 1,
      plan: 2,
      import: 3,
      email: 4,
      portal: 5,
      "upload-checks": 6,
      storage: 7,
      complete: 8,
    };
    return map[step];
  } else {
    const map: Record<AdminStep, number> = {
      account: 0,
      firm: 1,
      plan: 2,
      import: 3,
      email: 4,
      portal: 5,
      "upload-checks": -1,
      storage: -1,
      complete: 6,
    };
    return map[step];
  }
}

const MEMBER_STEPS = [
  { label: "Import Clients" },
  { label: "Configuration" },
  { label: "Complete" },
];

// ─── Plan tiers ───────────────────────────────────────────────────────────────

const PLAN_TIERS = [
  {
    key: "free",
    name: "Free",
    price: 0 as number | null,
    priceNote: "forever free",
    range: "Up to 10 clients",
    tagline: "Get started at no cost. Upgrade naturally when your practice grows.",
    featured: false,
  },
  {
    key: "solo",
    name: "Solo",
    price: 19 as number | null,
    priceNote: "/mo",
    range: "11 – 40 clients",
    tagline: "For sole traders and bookkeepers managing a small client list.",
    featured: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: 39 as number | null,
    priceNote: "/mo",
    range: "41 – 80 clients",
    tagline: "For independent accountants and small practices.",
    featured: false,
  },
  {
    key: "practice",
    name: "Practice",
    price: 69 as number | null,
    priceNote: "/mo",
    range: "81 – 200 clients",
    tagline: "For growing practices managing a wide range of deadlines.",
    featured: true,
  },
  {
    key: "firm",
    name: "Firm",
    price: 109 as number | null,
    priceNote: "/mo",
    range: "201 – 400 clients",
    tagline: "For established firms with a broad portfolio of clients.",
    featured: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugifyFirmName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const supabase = createClient();
  const router = useRouter();

  // ── Auth detection ──────────────────────────────────────────────────────────
  const [userType, setUserType] = useState<UserType>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ── New-admin step ──────────────────────────────────────────────────────────
  const [adminStep, setAdminStep] = useState<AdminStep>("firm");

  // ── Invited-member step (0=Import, 1=Config) ────────────────────────────────
  const [memberStep, setMemberStep] = useState(0);

  // ── Step 2: Firm Details ────────────────────────────────────────────────────
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [slugReason, setSlugReason] = useState<string | null>(null);
  const [firmError, setFirmError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Step 3: Plan ────────────────────────────────────────────────────────────
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgCreated, setOrgCreated] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // ── Import: persist rows so returning to the step skips re-upload ──────────
  const [savedImportRows, setSavedImportRows] = useState<EditableRow[] | null>(null);

  // ── Import + Config (steps 3–4 for member, 4–6 for admin) ──────────────────
  const [sendHour, setSendHour] = useState<number | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // ── Postmark settings (loaded alongside config defaults) ─────────────────
  const [orgDomain, setOrgDomain] = useState<string | undefined>(undefined);

  // ── Client portal ─────────────────────────────────────────────────────────
  // Tracks the user's choice made during the wizard; true = storage step shown
  const [clientPortalEnabled, setClientPortalEnabled] = useState(true);
  // Tracks whether the user has already visited the portal step (for restoring selection)
  const [portalSelection, setPortalSelection] = useState<"yes" | "no" | undefined>(undefined);

  // ── Upload checks step ─────────────────────────────────────────────────
  const [uploadCheckSelection, setUploadCheckSelection] = useState<UploadCheckMode | undefined>(undefined);

  // ── Storage step ─────────────────────────────────────────────────────────
  const [storageConnected, setStorageConnected] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [emailInitialSubStep, setEmailInitialSubStep] = useState<EmailSubStep>("input");

  // ── Complete step ────────────────────────────────────────────────────────
  const [dashboardUrl, setDashboardUrl] = useState("/dashboard");
  const [isLeavingWizard, setIsLeavingWizard] = useState(false);
  // Set to true before intentional navigations so the beforeunload guard doesn't fire
  const isNavigatingAway = useRef(false);

  // ── Guard against accidental unload (only when no restorable state) ────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNavigatingAway.current) return;
      // If wizard progress is saved, reload is safe — skip the warning
      if (sessionStorage.getItem("wizard_admin_step")) return;
      e.preventDefault();
      e.returnValue = "You haven't completed setup yet. Are you sure you want to leave?";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist wizard step to sessionStorage so browser-back restores position ─
  useEffect(() => {
    if (adminStep && adminStep !== "account" && adminStep !== "firm") {
      sessionStorage.setItem("wizard_admin_step", adminStep);
    }
  }, [adminStep]);

  useEffect(() => {
    sessionStorage.setItem("wizard_portal_enabled", clientPortalEnabled ? "1" : "0");
  }, [clientPortalEnabled]);

  // ── On mount: detect user type and starting step ────────────────────────────
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Check whether the user just signed up and needs to verify their email.
        // /signup stores the pending email in sessionStorage before redirecting here.
        const pendingEmail = sessionStorage.getItem("wizard_pending_email");
        if (pendingEmail) {
          // Show OTP verification as the first wizard step — no redirect needed
          setAdminStep("account");
          setUserType("new-admin");
          setIsCheckingAuth(false);
          return;
        }
        // No pending signup — clear any stale session and send to signup
        await supabase.auth.signOut();
        router.replace("/signup");
        return;
      }

      // If returning from an external redirect (Stripe checkout, OAuth), the
      // access token may be stale. Refresh so the JWT has the latest
      // app_metadata (including org_id) — required by RLS on user_organisations.
      const urlParams = new URLSearchParams(window.location.search);
      const hasReturnParams = urlParams.has("from") || urlParams.has("storage_connected") || urlParams.has("storage_error");
      if (hasReturnParams || sessionStorage.getItem("wizard_return_step") || sessionStorage.getItem("wizard_admin_step")) {
        await supabase.auth.refreshSession();
      }

      // Check whether user has an org
      const { data: userOrg } = await supabase
        .from("user_organisations")
        .select("org_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (!userOrg?.org_id) {
        // Authenticated but no org → new-admin, start at firm
        setUserType("new-admin");
        setAdminStep("firm");
      } else if (userOrg.role === "admin") {
        const sc = urlParams.get("storage_connected");
        const se = urlParams.get("storage_error");
        const fromStripe = urlParams.get("from") === "stripe";
        setUserType("new-admin");
        setOrgCreated(true);

        // Clean URL params without triggering a reload
        if (sc || se || fromStripe) {
          window.history.replaceState({}, "", window.location.pathname);
        }

        if (sc || se) {
          // Returning from storage OAuth (success or failure via callback redirect)
          sessionStorage.removeItem("wizard_return_step");
          setStorageConnected(sc);
          setStorageError(se);
          setAdminStep("storage");
          const url = await getWizardDashboardUrl();
          setDashboardUrl(url);
        } else if (fromStripe) {
          // Returning from Stripe checkout — advance to import
          sessionStorage.removeItem("wizard_return_step");
          setAdminStep("import");
          prefetchConfigDefaults();
        } else {
          // Restore wizard position from sessionStorage (covers browser-back from
          // OAuth pages and any other mid-wizard navigation)
          const savedReturnStep = sessionStorage.getItem("wizard_return_step");
          const savedAdminStep = sessionStorage.getItem("wizard_admin_step");
          const savedPortal = sessionStorage.getItem("wizard_portal_enabled");

          if (savedReturnStep === "stripe") {
            // Returning from Stripe checkout (sessionStorage fallback) — advance to import
            sessionStorage.removeItem("wizard_return_step");
            setAdminStep("import");
            prefetchConfigDefaults();
          } else if (savedReturnStep === "storage" || savedAdminStep === "storage") {
            // Returning from storage OAuth (failed before callback, or browser-back)
            sessionStorage.removeItem("wizard_return_step");
            if (savedPortal !== null) setClientPortalEnabled(savedPortal === "1");
            setAdminStep("storage");
            const url = await getWizardDashboardUrl();
            setDashboardUrl(url);
          } else if (
            savedAdminStep &&
            ["import", "email", "portal", "upload-checks", "complete"].includes(savedAdminStep)
          ) {
            // Restore to whichever step they were on
            if (savedPortal !== null) setClientPortalEnabled(savedPortal === "1");
            setAdminStep(savedAdminStep as AdminStep);
            prefetchConfigDefaults();
            if (savedAdminStep === "complete") {
              const url = await getWizardDashboardUrl();
              setDashboardUrl(url);
            }
          } else {
            // Fallback: start at import
            setAdminStep("import");
            prefetchConfigDefaults();
          }
        }
      } else {
        // Invited member → 2-step flow, start at import
        setUserType("invited-member");
        setMemberStep(0);
        prefetchConfigDefaults();
      }

      setIsCheckingAuth(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Slug availability check ─────────────────────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────────────────

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

      // Refresh session so JWT has org_id before advancing
      await supabase.auth.refreshSession();

      if (tier === "free") {
        prefetchConfigDefaults();
        setIsCreatingOrg(false);
        setOrgCreated(true);
        setAdminStep("import");
      } else {
        // Paid plan: redirect to Stripe Checkout, return to /setup/wizard
        const response = await fetch("/api/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planTier: tier,
            orgId: result.orgId,
            successUrl: "/setup/wizard?from=stripe",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setPlanError(data.error || "Failed to start checkout. Please try again.");
          setSelectedTier(null);
          setIsCreatingOrg(false);
          return;
        }

        if (data.url) {
          sessionStorage.setItem("wizard_return_step", "stripe");
          isNavigatingAway.current = true;
          window.location.href = data.url;
          // Don't reset loading — navigating away
        } else {
          setPlanError("Checkout session created but no redirect URL was returned. Please try again.");
          setSelectedTier(null);
          setIsCreatingOrg(false);
        }
      }
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

  const handleImportComplete = () => {
    if (userType === "new-admin") {
      setAdminStep("email");
    } else {
      setMemberStep(1);
    }
    // Prefetch config defaults if not yet loaded
    if (sendHour === null) {
      prefetchConfigDefaults();
    }
  };


  const handleConfigComplete = async () => {
    setIsCompleting(true);
    setCompleteError(null);

    const result = await markMemberSetupComplete();

    if (result.error) {
      setCompleteError(result.error);
      setIsCompleting(false);
      return;
    }

    // Build reminder queue in the background so queued emails appear immediately
    fetch("/api/reminders/rebuild-queue", { method: "POST" }).catch(() => {
      // Non-blocking — cron will catch up if this fails
    });

    // Refresh the session so the JWT contains org_id in app_metadata.
    // Without this, the middleware's fallback RLS query on user_organisations
    // (which requires org_id = auth_org_id()) returns no rows and redirects
    // the user to the marketing site instead of their dashboard.
    // This is critical for paid-tier users who go through Stripe and never
    // had refreshSession() called after org creation.
    await supabase.auth.refreshSession();

    // Resolve dashboard URL via server action (uses admin client, bypasses RLS).
    const url = await getWizardDashboardUrl();

    setDashboardUrl(url);
    setIsCompleting(false);

    // Advance to the portal step (admin) or complete step (member)
    if (userType === "new-admin") {
      setAdminStep("portal");
    } else {
      setMemberStep(2);
    }
  };

  const handlePortalComplete = (enabled: boolean) => {
    setClientPortalEnabled(enabled);
    setPortalSelection(enabled ? "yes" : "no");
    if (enabled) {
      setAdminStep("upload-checks");
    } else {
      setAdminStep("complete");
    }
  };

  const handleUploadChecksComplete = (mode: UploadCheckMode) => {
    setUploadCheckSelection(mode);
    setAdminStep("storage");
  };

  const handleStorageComplete = () => {
    setAdminStep("complete");
  };

  const handleGoToDashboard = async () => {
    setIsLeavingWizard(true);
    await seedOrgDefaultsForWizard(clientPortalEnabled);
    await markOrgSetupComplete();
    // Refresh session server-side so the .prompt.accountants cross-subdomain
    // cookie gets an updated JWT with org_id in app_metadata. Without this,
    // the stale cookie (set before org creation) reaches the subdomain middleware,
    // the fallback user_organisations RLS query fails, and the user is sent to
    // the marketing site instead of their dashboard.
    await refreshWizardSession();
    // Clean up wizard sessionStorage keys
    sessionStorage.removeItem("wizard_admin_step");
    sessionStorage.removeItem("wizard_portal_enabled");
    sessionStorage.removeItem("wizard_return_step");
    isNavigatingAway.current = true;
    window.location.href = dashboardUrl;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isCheckingAuth || userType === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Invited-member path (2 steps) ───────────────────────────────────────────
  if (userType === "invited-member") {
    return (
      <div className="space-y-12">
        <WizardStepper
          steps={MEMBER_STEPS}
          currentStep={memberStep}
          onStepClick={(index) => setMemberStep(index)}
        />

        {memberStep === 0 && (
          <div className="min-h-[520px]">
            <CsvImportStep
              onComplete={handleImportComplete}
              initialRows={savedImportRows ?? undefined}
              onRowsChange={setSavedImportRows}
            />
          </div>
        )}

        {memberStep === 1 && sendHour !== null && emailSettings !== null && (
          <div className="min-h-[520px]">
            <ConfigStep
              defaultSendHour={sendHour}
              defaultEmailSettings={emailSettings}
              onComplete={handleConfigComplete}
              onBack={() => setMemberStep(0)}
              orgDomain={orgDomain}
              isMember
              isCompleting={isCompleting}
              completeError={completeError}
            />
          </div>
        )}

        {memberStep === 1 && (sendHour === null || emailSettings === null) && (
          <div className="flex items-center justify-center min-h-[520px]">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {memberStep === 2 && (
          <div className="max-w-md mx-auto space-y-6 min-h-[520px]">
            <div className="text-center space-y-4">
              <div className="mx-auto size-14 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="size-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  You&apos;re all set!
                </h1>
                <p className="text-muted-foreground">
                  Your account is configured and ready to go. You can start
                  managing client reminders from your dashboard.
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Check className="size-4 text-green-600 shrink-0" />
                  <span className="text-sm">Client data imported</span>
                </div>
                <div className="flex items-center gap-3">
                  <Check className="size-4 text-green-600 shrink-0" />
                  <span className="text-sm">Email settings configured</span>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full active:scale-[0.97]"
              onClick={handleGoToDashboard}
              disabled={isLeavingWizard}
            >
              {isLeavingWizard ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Go to Dashboard
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── New-admin path ─────────────────────────────────────────────────────────
  const adminSteps = getAdminSteps(clientPortalEnabled);
  const currentStepIndex = adminStepToIndex(adminStep, clientPortalEnabled);

  return (
    <div className="space-y-12">
      <WizardStepper
        steps={adminSteps}
        currentStep={currentStepIndex}
        onStepClick={(index) => {
          // Verify Email step (0) is always locked — can't go back after auth
          if (index === 0) return;
          // Firm step (1) is locked once the org is created (slug already registered)
          if (index === 1 && orgCreated) return;
          const stepNames: AdminStep[] = clientPortalEnabled
            ? ["account", "firm", "plan", "import", "email", "portal", "upload-checks", "storage", "complete"]
            : ["account", "firm", "plan", "import", "email", "portal", "complete"];
          setAdminStep(stepNames[index]);
        }}
      />

      {/* ── Step 0: Email verification (pre-wizard, no stepper shown) ── */}
      {adminStep === "account" && (
        <AccountSetupStep
          onComplete={handleAccountComplete}
          initialEmail={sessionStorage.getItem("wizard_pending_email") ?? undefined}
          initialSubStep="verify"
        />
      )}

      {/* ── Step 1: Firm Details ── */}
      {adminStep === "firm" && (
        <div className="max-w-md mx-auto space-y-4 min-h-[520px]">
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            {/* Heading inside the box */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Tell us about your firm
              </h1>
              <p className="text-sm text-muted-foreground">
                Your firm name and URL slug are used to set up your private workspace.
              </p>
            </div>

            <div className="space-y-5">
              {/* Firm Name */}
              <div className="space-y-1.5">
                <Label htmlFor="firmName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Firm name</Label>
                <Input
                  id="firmName"
                  placeholder="Acme Accounting Ltd"
                  value={firmName}
                  onChange={(e) => handleFirmNameChange(e.target.value)}
                  autoFocus
                />
              </div>

              {/* URL Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="slug" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">URL slug</Label>
                <div className="flex-1 relative">
                  <Input
                    id="slug"
                    placeholder="acme-accounting"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="pr-8"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {slugStatus === "checking" && (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    )}
                    {slugStatus === "available" && null}
                    {slugStatus === "unavailable" && (
                      <X className="size-4 text-destructive" />
                    )}
                  </div>
                </div>

                {slug && slugStatus === "available" && (
                  <div className="flex items-center gap-3 p-3 mt-3 bg-green-500/10 rounded-xl">
                    <CheckCircle className="size-5 text-green-600 shrink-0" />
                    <p className="text-sm text-green-600">
                      Your workspace URL:{" "}
                      <span className="font-medium">
                        {slug}.app.
                        {(
                          process.env.NEXT_PUBLIC_APP_URL || "https://prompt.accountants"
                        ).replace(/^https?:\/\/(www\.)?/, "")}
                      </span>
                    </p>
                  </div>
                )}
                {slugStatus === "unavailable" && slugReason && (
                  <p className="text-xs text-destructive">{slugReason}</p>
                )}
                {!slug && (
                  <p className="text-xs text-muted-foreground">
                    Enter your firm name above to auto-suggest a slug, or type your own.
                  </p>
                )}
              </div>

              {firmError && (
                <p className="text-sm text-destructive">{firmError}</p>
              )}
            </div>
          </div>

          {/* Buttons outside the box, right-aligned together */}
          <div className="flex justify-end gap-2">
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={handleFirmContinue}
              disabled={!firmName.trim() || slugStatus !== "available"}
            >
              Next Step
              <ArrowRight className="size-4" />
            </ButtonBase>
          </div>
        </div>
      )}

      {/* ── Step 3: Plan Selection ── */}
      {adminStep === "plan" && (
        <div className="max-w-4xl mx-auto space-y-4 min-h-[520px]">
          <div className="rounded-2xl border bg-card shadow-sm p-4 sm:p-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
              <p className="text-sm text-muted-foreground">
                Select the plan that fits your practice. You can upgrade or change any time from Settings.
              </p>
            </div>
            {planError && (
              <p className="text-sm text-destructive">{planError}</p>
            )}

            {/* 5 cards — responsive: 2 cols mobile, 3 cols tablet, 5 cols desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {PLAN_TIERS.map((plan) => {
                const isSelected = selectedTier === plan.key;
                const isThisLoading = isCreatingOrg && isSelected;
                return (
                  <div key={plan.key} className="flex flex-col">
                    <div
                      className={[
                        "flex flex-col flex-1 p-4 rounded-xl border-2 transition-all duration-200",
                        isSelected
                          ? "border-violet-500"
                          : "border-border/60 hover:border-border",
                      ].join(" ")}
                    >
                      <p className="text-sm font-bold text-foreground mb-3">{plan.name}</p>
                      <div className="mb-1">
                        {plan.price === 0 ? (
                          <>
                            <span className="text-2xl font-bold text-foreground tabular-nums">£0</span>
                            <span className="text-xs text-muted-foreground ml-1">free</span>
                          </>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-foreground tabular-nums">£{plan.price}</span>
                            <span className="text-xs text-muted-foreground ml-1">/mo</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-foreground/60 mb-2">{plan.range}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">{plan.tagline}</p>
                      <ButtonBase
                        variant={isSelected ? "violet" : "muted"}
                        isSelected={isSelected}
                        buttonType="icon-text"
                        disabled={isCreatingOrg}
                        onClick={() => {
                          setSelectedTier(plan.key as PlanTier);
                          setPlanError(null);
                        }}
                      >
                        {isThisLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isSelected ? (
                          <><Check className="size-4" /> Selected</>
                        ) : (
                          "Select"
                        )}
                      </ButtonBase>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VAT note outside individual cards */}
            <p className="text-xs text-muted-foreground/60 text-center">All prices exclude VAT.</p>
          </div>

          <div className="flex justify-end gap-2">
            {!orgCreated && (
              <ButtonBase
                variant="amber"
                buttonType="icon-text"
                onClick={() => setAdminStep("firm")}
                disabled={isCreatingOrg}
              >
                <ArrowLeft className="size-4" />
                Back
              </ButtonBase>
            )}
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={() => {
                if (orgCreated) {
                  setAdminStep("import");
                } else if (selectedTier) {
                  handleSelectPlan(selectedTier);
                }
              }}
              disabled={!orgCreated && (!selectedTier || isCreatingOrg)}
            >
              {isCreatingOrg ? (
                <><Loader2 className="size-4 animate-spin" /> Processing...</>
              ) : (
                <>Next Step <ArrowRight className="size-4" /></>
              )}
            </ButtonBase>
          </div>
        </div>
      )}

      {/* ── Step 4: Import Clients ── */}
      {adminStep === "import" && (
        <div className="min-h-[520px]">
          <CsvImportStep
            onComplete={handleImportComplete}
            onBack={() => setAdminStep("plan")}
            initialRows={savedImportRows ?? undefined}
            onRowsChange={setSavedImportRows}
          />
        </div>
      )}

      {/* ── Step 5: Email Setup (includes email identity + send settings sub-steps) ── */}
      {adminStep === "email" && sendHour !== null && emailSettings !== null && (
        <div className="min-h-[520px]">
          <EmailSetupStep
            onComplete={handleConfigComplete}
            onBack={() => setAdminStep("import")}
            defaultSendHour={sendHour}
            defaultEmailSettings={emailSettings}
            orgDomain={orgDomain}
            isCompleting={isCompleting}
            completeError={completeError}
            initialState={emailInitialSubStep}
          />
        </div>
      )}
      {adminStep === "email" && (sendHour === null || emailSettings === null) && (
        <div className="flex items-center justify-center min-h-[520px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Step 5b: Client Portal ── */}
      {adminStep === "portal" && (
        <div className="min-h-[520px]">
          <ClientPortalStep
            onComplete={handlePortalComplete}
            initialSelection={portalSelection}
            onBack={() => {
              setEmailInitialSubStep("settings");
              prefetchConfigDefaults();
              setAdminStep("email");
            }}
          />
        </div>
      )}

      {/* ── Step 5c: Upload Checks ── */}
      {adminStep === "upload-checks" && (
        <div className="min-h-[520px]">
          <UploadChecksStep
            onComplete={handleUploadChecksComplete}
            onBack={() => setAdminStep("portal")}
            initialSelection={uploadCheckSelection}
          />
        </div>
      )}

      {/* ── Step 5d: Storage Setup ── */}
      {adminStep === "storage" && (
        <div className="min-h-[520px]">
          <StorageSetupStep
            storageConnected={storageConnected}
            storageError={storageError}
            onComplete={handleStorageComplete}
            onBack={() => setAdminStep("upload-checks")}
            onBeforeProviderConnect={() => {
              isNavigatingAway.current = true;
              sessionStorage.setItem("wizard_return_step", "storage");
            }}
          />
        </div>
      )}

      {/* ── Step 6: Complete ── */}
      {adminStep === "complete" && (
        <div className="max-w-md mx-auto space-y-4 min-h-[520px]">
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                Setup complete!
              </h1>
              <p className="text-sm text-muted-foreground">
                Your firm is set up and ready to go. Start managing client
                deadlines and sending reminders from your dashboard.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">Firm workspace created</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">Plan selected</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">Client data imported</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">Email sending configured</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">Reminder settings saved</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <ButtonBase
              variant="amber"
              buttonType="icon-text"
              onClick={() => setAdminStep(clientPortalEnabled ? "storage" : "portal")}
            >
              <ArrowLeft className="size-4" />
              Back
            </ButtonBase>
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={handleGoToDashboard}
              disabled={isLeavingWizard}
            >
              {isLeavingWizard ? <Loader2 className="size-4 animate-spin" /> : "Go to Dashboard"}
              {!isLeavingWizard && <ArrowRight className="size-4" />}
            </ButtonBase>
          </div>
        </div>
      )}
    </div>
  );
}
