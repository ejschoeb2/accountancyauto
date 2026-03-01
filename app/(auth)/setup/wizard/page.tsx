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
import { CsvImportStep } from "./components/csv-import-step";
import { ConfigStep } from "./components/config-step";
import { EmailSetupStep } from "./components/email-setup-step";
import { StorageSetupStep } from "./components/storage-setup-step";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/stripe/plans";
import {
  sendSetupMagicLink,
  checkSlugAvailable,
  createOrgAndJoinAsAdmin,
  getWizardDashboardUrl,
} from "./actions";
import {
  markMemberSetupComplete,
  getUserSendHour,
  getUserEmailSettings,
  getInboundCheckerMode,
  getPostmarkSettings,
  type EmailSettings,
  type InboundCheckerMode,
} from "@/app/actions/settings";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserType = "new-admin" | "invited-member" | null;

// New-admin step names (index matches ADMIN_STEPS position)
type AdminStep = "account" | "firm" | "plan" | "import" | "email" | "storage" | "complete";

// ─── Step arrays ──────────────────────────────────────────────────────────────

const ADMIN_STEPS = [
  { label: "Firm Details" },
  { label: "Plan" },
  { label: "Import Clients" },
  { label: "Email Setup" },
  { label: "Storage" },
  { label: "Complete" },
];

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
    range: "Up to 25 clients",
    tagline: "Get started at no cost. Upgrade naturally when your practice grows.",
    featured: false,
    isEnterprise: false,
  },
  {
    key: "starter",
    name: "Starter",
    price: 39 as number | null,
    priceNote: "/mo",
    range: "26 – 100 clients",
    tagline: "For independent accountants and small practices.",
    featured: false,
    isEnterprise: false,
  },
  {
    key: "practice",
    name: "Practice",
    price: 89 as number | null,
    priceNote: "/mo",
    range: "101+ clients",
    tagline: "For growing practices managing a wide range of deadlines.",
    featured: true,
    isEnterprise: false,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: null,
    priceNote: "pricing",
    range: "500+ clients",
    tagline: "For large firms with complex needs. Let's build a plan around you.",
    featured: false,
    isEnterprise: true,
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

function adminStepToIndex(step: AdminStep): number {
  const map: Record<AdminStep, number> = {
    account: -1, // not shown in progress bar
    firm: 0,
    plan: 1,
    import: 2,
    email: 3,
    storage: 4,
    complete: 5,
  };
  return map[step];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const supabase = createClient();
  const router = useRouter();

  // ── Auth detection ──────────────────────────────────────────────────────────
  const [userType, setUserType] = useState<UserType>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // ── New-admin step ──────────────────────────────────────────────────────────
  const [adminStep, setAdminStep] = useState<AdminStep>("account");

  // ── Invited-member step (0=Import, 1=Config) ────────────────────────────────
  const [memberStep, setMemberStep] = useState(0);

  // ── Step 1: Account ─────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  // Only true when user started unauthenticated (so Back on firm step is valid)
  const [canGoBackToAccount, setCanGoBackToAccount] = useState(false);

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

  // ── Import + Config (steps 3–4 for member, 4–6 for admin) ──────────────────
  const [sendHour, setSendHour] = useState<number | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [inboundMode, setInboundMode] = useState<InboundCheckerMode | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // ── Postmark settings (loaded alongside config defaults) ─────────────────
  const [orgDomain, setOrgDomain] = useState<string | undefined>(undefined);
  const [orgInboundAddress, setOrgInboundAddress] = useState<string | undefined>(undefined);

  // ── Storage step ─────────────────────────────────────────────────────────
  const [storageConnected, setStorageConnected] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  // ── Complete step ────────────────────────────────────────────────────────
  const [dashboardUrl, setDashboardUrl] = useState("/dashboard");
  // Set to true before intentional navigations so the beforeunload guard doesn't fire
  const isNavigatingAway = useRef(false);

  // ── Warn before unload / redirect to home on reload ────────────────────────
  useEffect(() => {
    // Redirect to home if the user reloads mid-wizard (prevents stale slug errors)
    const navEntries = performance.getEntriesByType("navigation");
    if (
      navEntries.length > 0 &&
      (navEntries[0] as PerformanceNavigationTiming).type === "reload"
    ) {
      router.replace("/");
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isNavigatingAway.current) return;
      e.preventDefault();
      e.returnValue = "Refreshing will reset the setup wizard and you'll need to start again.";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── On mount: detect user type and starting step ────────────────────────────
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Unauthenticated → new-admin, start at account
        setUserType("new-admin");
        setAdminStep("account");
        setCanGoBackToAccount(true);
        setIsCheckingAuth(false);
        return;
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
        const urlParams = new URLSearchParams(window.location.search);
        const sc = urlParams.get("storage_connected");
        const se = urlParams.get("storage_error");
        setUserType("new-admin");
        setOrgCreated(true);
        if (sc || se) {
          // Returning from storage OAuth
          setStorageConnected(sc);
          setStorageError(se);
          setAdminStep("storage");
          const url = await getWizardDashboardUrl();
          setDashboardUrl(url);
        } else {
          // Returning from Stripe, start at import
          setAdminStep("import");
          prefetchConfigDefaults();
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
      getInboundCheckerMode(),
      getPostmarkSettings(),
    ]).then(([hour, settings, mode, postmark]) => {
      setSendHour(hour);
      setEmailSettings(settings);
      setInboundMode(mode);
      if (postmark.senderDomain) setOrgDomain(postmark.senderDomain);
      if (postmark.inboundAddress) setOrgInboundAddress(postmark.inboundAddress);
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

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      setAccountError("Please enter your email address.");
      return;
    }

    setIsSendingLink(true);
    setAccountError(null);

    const result = await sendSetupMagicLink(email.trim());

    if (result.error) {
      setAccountError(result.error);
    } else {
      setLinkSent(true);
    }

    setIsSendingLink(false);
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

      if (tier === "free") {
        // Refresh session so JWT has org_id before advancing to Import
        await supabase.auth.refreshSession();
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
            successUrl: "/setup/wizard",
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
          window.location.href = data.url;
          // Don't reset loading — navigating away
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

    // Resolve dashboard URL via server action (uses admin client, bypasses RLS
    // and avoids the session-clearing risk of calling refreshSession() here).
    const url = await getWizardDashboardUrl();

    setDashboardUrl(url);
    setIsCompleting(false);

    // Advance to the storage step (admin) or complete step (member)
    if (userType === "new-admin") {
      setAdminStep("storage");
    } else {
      setMemberStep(2);
    }
  };

  const handleStorageComplete = () => {
    setAdminStep("complete");
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
        <WizardStepper steps={MEMBER_STEPS} currentStep={memberStep} />

        {memberStep === 0 && (
          <div className="min-h-[520px]">
            <CsvImportStep onComplete={handleImportComplete} />
          </div>
        )}

        {memberStep === 1 && sendHour !== null && emailSettings !== null && inboundMode !== null && (
          <div className="min-h-[520px]">
            <ConfigStep
              defaultSendHour={sendHour}
              defaultEmailSettings={emailSettings}
              defaultInboundMode={inboundMode}
              onComplete={handleConfigComplete}
              onBack={() => setMemberStep(0)}
              orgDomain={orgDomain}
              orgInboundAddress={orgInboundAddress}
              isMember
              isCompleting={isCompleting}
              completeError={completeError}
            />
          </div>
        )}

        {memberStep === 1 && (sendHour === null || emailSettings === null || inboundMode === null) && (
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
              onClick={() => { isNavigatingAway.current = true; window.location.href = dashboardUrl; }}
            >
              Go to Dashboard
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── New-admin path (5 steps) ─────────────────────────────────────────────────
  const currentStepIndex = adminStepToIndex(adminStep);

  return (
    <div className="space-y-12">
      {adminStep !== "account" && (
        <WizardStepper steps={ADMIN_STEPS} currentStep={currentStepIndex} />
      )}

      {/* ── Step 1: Account ── */}
      {adminStep === "account" && (
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Create your account
            </h1>
            <p className="text-muted-foreground">
              Enter your email address to get started. We&apos;ll send you a
              magic link to verify your account.
            </p>
          </div>

          {!linkSent ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@yourfirm.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSendMagicLink();
                    }}
                    disabled={isSendingLink}
                    autoFocus
                  />
                </div>

                {accountError && (
                  <p className="text-sm text-destructive">{accountError}</p>
                )}

                <Button
                  className="w-full active:scale-[0.97]"
                  onClick={handleSendMagicLink}
                  disabled={isSendingLink || !email.trim()}
                >
                  {isSendingLink ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Magic Link"
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle className="size-5 text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">Magic link sent — check your inbox.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email address</Label>
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground items-center cursor-not-allowed select-none">
                      {email}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Didn&apos;t receive it?{" "}
                    <button
                      className="underline hover:text-foreground transition-colors"
                      onClick={() => {
                        setLinkSent(false);
                        setAccountError(null);
                      }}
                    >
                      Try again
                    </button>
                  </p>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <ButtonBase
                  variant="green"
                  buttonType="icon-text"
                  onClick={() => setAdminStep("firm")}
                >
                  Next Step
                  <ArrowRight className="size-4" />
                </ButtonBase>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Firm Details ── */}
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
            {canGoBackToAccount && (
              <ButtonBase
                variant="amber"
                buttonType="icon-text"
                onClick={() => setAdminStep("account")}
              >
                <ArrowLeft className="size-4" />
                Back
              </ButtonBase>
            )}
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
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">Choose your plan</h1>
              <p className="text-sm text-muted-foreground">
                Select the plan that fits your practice. You can upgrade or change any time from Settings.
              </p>
            </div>
            {planError && (
              <p className="text-sm text-destructive">{planError}</p>
            )}

            {/* 4 cards side-by-side */}
            <div className="grid grid-cols-4 gap-3">
              {PLAN_TIERS.map((plan) => {
                const isSelected = selectedTier === plan.key;
                const isThisLoading = isCreatingOrg && isSelected;
                return (
                  <div key={plan.key} className="flex flex-col">
                    <div
                      className={[
                        "flex flex-col flex-1 p-5 rounded-xl border-2 transition-all duration-200",
                        isSelected
                          ? "border-violet-500"
                          : "border-border/60 hover:border-border",
                      ].join(" ")}
                    >
                      <p className="text-sm font-bold text-foreground mb-3">{plan.name}</p>
                      <div className="mb-1">
                        {plan.price === null ? (
                          <span className="text-2xl font-bold text-foreground">Custom</span>
                        ) : plan.price === 0 ? (
                          <>
                            <span className="text-3xl font-bold text-foreground tabular-nums">£0</span>
                            <span className="text-xs text-muted-foreground ml-1.5">forever free</span>
                          </>
                        ) : (
                          <>
                            <span className="text-3xl font-bold text-foreground tabular-nums">£{plan.price}</span>
                            <span className="text-xs text-muted-foreground ml-1.5">/mo</span>
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
                          if (plan.isEnterprise) {
                            window.location.href = "mailto:hello@phasetwo.uk";
                            return;
                          }
                          setSelectedTier(plan.key as PlanTier);
                          setPlanError(null);
                        }}
                      >
                        {isThisLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : isSelected ? (
                          <><Check className="size-4" /> Selected</>
                        ) : plan.isEnterprise ? (
                          "Get in Touch"
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
            onBack={orgCreated ? undefined : () => setAdminStep("plan")}
          />
        </div>
      )}

      {/* ── Step 5: Email Setup (includes email identity + send settings sub-steps) ── */}
      {adminStep === "email" && sendHour !== null && emailSettings !== null && inboundMode !== null && (
        <div className="min-h-[520px]">
          <EmailSetupStep
            onComplete={handleConfigComplete}
            onBack={() => setAdminStep("import")}
            defaultSendHour={sendHour}
            defaultEmailSettings={emailSettings}
            defaultInboundMode={inboundMode}
            orgDomain={orgDomain}
            orgInboundAddress={orgInboundAddress}
            isCompleting={isCompleting}
            completeError={completeError}
          />
        </div>
      )}
      {adminStep === "email" && (sendHour === null || emailSettings === null || inboundMode === null) && (
        <div className="flex items-center justify-center min-h-[520px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Step 5b: Storage Setup ── */}
      {adminStep === "storage" && (
        <div className="min-h-[520px]">
          <StorageSetupStep
            storageConnected={storageConnected}
            storageError={storageError}
            onComplete={handleStorageComplete}
            onBack={() => setAdminStep("email")}
            onBeforeProviderConnect={() => { isNavigatingAway.current = true; }}
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
              onClick={() => setAdminStep("storage")}
            >
              <ArrowLeft className="size-4" />
              Back
            </ButtonBase>
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={() => { isNavigatingAway.current = true; window.location.href = dashboardUrl; }}
            >
              Go to Dashboard
              <ArrowRight className="size-4" />
            </ButtonBase>
          </div>
        </div>
      )}
    </div>
  );
}
