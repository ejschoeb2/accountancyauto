"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  Check,
  X,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { WizardStepper } from "@/components/wizard-stepper";
import { CsvImportStep } from "./components/csv-import-step";
import { ConfigStep } from "./components/config-step";
import { EmailSetupStep } from "./components/email-setup-step";
import { createClient } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/stripe/plans";
import { PricingSlider } from "@/components/pricing-slider";
import {
  sendSetupMagicLink,
  checkSlugAvailable,
  createOrgAndJoinAsAdmin,
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
type AdminStep = "account" | "firm" | "plan" | "import" | "email" | "config" | "complete";

// ─── Step arrays ──────────────────────────────────────────────────────────────

const ADMIN_STEPS = [
  { label: "Account" },
  { label: "Firm Details" },
  { label: "Plan" },
  { label: "Import Clients" },
  { label: "Email Setup" },
  { label: "Configuration" },
  { label: "Complete" },
];

const MEMBER_STEPS = [
  { label: "Import Clients" },
  { label: "Configuration" },
  { label: "Complete" },
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
    account: 0,
    firm: 1,
    plan: 2,
    import: 3,
    email: 4,
    config: 5,
    complete: 6,
  };
  return map[step];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const supabase = createClient();

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

  // ── Complete step ────────────────────────────────────────────────────────
  const [dashboardUrl, setDashboardUrl] = useState("/dashboard");

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
        // Admin with org → returning from Stripe, start at import
        setUserType("new-admin");
        setAdminStep("import");
        prefetchConfigDefaults();
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

  const handleEmailSetupComplete = () => {
    // Re-fetch Postmark settings so config step has the latest domain/inbound address
    getPostmarkSettings().then((postmark) => {
      if (postmark.senderDomain) setOrgDomain(postmark.senderDomain);
      if (postmark.inboundAddress) setOrgInboundAddress(postmark.inboundAddress);
    });
    setAdminStep("config");
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

    // Refresh session so the JWT carries the latest org_id
    await supabase.auth.refreshSession();

    // Resolve the org slug to build the correct dashboard URL
    let url = "/dashboard";
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from("user_organisations")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.org_id) {
        const { data: org } = await supabase
          .from("organisations")
          .select("slug")
          .eq("id", membership.org_id)
          .maybeSingle();

        if (org?.slug) {
          const isDev = window.location.hostname === "localhost";
          if (isDev) {
            url = `/dashboard?org=${org.slug}`;
          } else {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.qpon";
            const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
            url = `https://${org.slug}.app.${baseDomain}/dashboard`;
          }
        }
      }
    }

    setDashboardUrl(url);
    setIsCompleting(false);

    // Advance to the complete step
    if (userType === "new-admin") {
      setAdminStep("complete");
    } else {
      setMemberStep(2);
    }
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
      <div className="space-y-8">
        <WizardStepper steps={MEMBER_STEPS} currentStep={memberStep} />

        {memberStep === 0 && (
          <CsvImportStep onComplete={handleImportComplete} />
        )}

        {memberStep === 1 && sendHour !== null && emailSettings !== null && inboundMode !== null && (
          <div className="space-y-4">
            <ConfigStep
              defaultSendHour={sendHour}
              defaultEmailSettings={emailSettings}
              defaultInboundMode={inboundMode}
              onComplete={handleConfigComplete}
              orgDomain={orgDomain}
              orgInboundAddress={orgInboundAddress}
              isMember
            />
            {isCompleting && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Completing setup...
              </div>
            )}
            {completeError && (
              <p className="text-sm text-destructive">{completeError}</p>
            )}
          </div>
        )}

        {memberStep === 1 && (sendHour === null || emailSettings === null || inboundMode === null) && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {memberStep === 2 && (
          <div className="max-w-md mx-auto space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
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
              onClick={() => { window.location.href = dashboardUrl; }}
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
    <div className="space-y-8">
      <WizardStepper steps={ADMIN_STEPS} currentStep={currentStepIndex} />

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
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
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
            <Card>
              <CardContent className="pt-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle className="size-6 text-green-600" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-semibold">Check your email</h2>
                  <p className="text-sm text-muted-foreground">
                    We sent a magic link to{" "}
                    <span className="font-medium text-foreground">{email}</span>.
                    Click the link to continue.
                  </p>
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
          )}
        </div>
      )}

      {/* ── Step 2: Firm Details ── */}
      {adminStep === "firm" && (
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Tell us about your firm
            </h1>
            <p className="text-muted-foreground">
              Your firm name and URL slug are used to set up your private
              workspace.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-5">
              {/* Firm Name */}
              <div className="space-y-2">
                <Label htmlFor="firmName">Firm name</Label>
                <Input
                  id="firmName"
                  placeholder="Acme Accounting Ltd"
                  value={firmName}
                  onChange={(e) => handleFirmNameChange(e.target.value)}
                  autoFocus
                />
              </div>

              {/* URL Slug */}
              <div className="space-y-2">
                <Label htmlFor="slug">URL slug</Label>
                <div className="flex items-center gap-2">
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
                      {slugStatus === "available" && (
                        <Check className="size-4 text-green-600" />
                      )}
                      {slugStatus === "unavailable" && (
                        <X className="size-4 text-destructive" />
                      )}
                    </div>
                  </div>
                </div>

                {slug && slugStatus === "available" && (
                  <p className="text-xs text-green-600">
                    Your workspace URL:{" "}
                    <span className="font-medium">
                      {slug}.app.
                      {(
                        process.env.NEXT_PUBLIC_APP_URL || "https://prompt.qpon"
                      ).replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                  </p>
                )}
                {slugStatus === "unavailable" && slugReason && (
                  <p className="text-xs text-destructive">{slugReason}</p>
                )}
                {!slug && (
                  <p className="text-xs text-muted-foreground">
                    Enter your firm name above to auto-suggest a slug, or type
                    your own.
                  </p>
                )}
              </div>

              {firmError && (
                <p className="text-sm text-destructive">{firmError}</p>
              )}

              <div className="flex justify-between pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setAdminStep("account")}
                  className="gap-1"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={handleFirmContinue}
                  disabled={!firmName.trim() || slugStatus !== "available"}
                  className="gap-1 active:scale-[0.97]"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 3: Plan Selection ── */}
      {adminStep === "plan" && (
        <div className="space-y-6">
          {planError && (
            <p className="text-sm text-destructive text-center">{planError}</p>
          )}
          <PricingSlider
            defaultClients={1}
            onSelectTier={(tierKey) => {
              if (tierKey === "enterprise") {
                window.location.href = "mailto:hello@phasetwo.uk";
                return;
              }
              handleSelectPlan(tierKey as PlanTier);
            }}
            ctaLabels={{
              free: "Start Free",
              starter: "Subscribe & Continue",
              practice: "Subscribe & Continue",
              enterprise: "Get in Touch",
            }}
            showUpgradeNote={true}
            isLoading={isCreatingOrg}
            loadingTier={selectedTier}
          />
          <div className="flex justify-start max-w-screen-xl mx-auto px-4">
            <Button
              variant="ghost"
              onClick={() => setAdminStep("firm")}
              disabled={isCreatingOrg}
              className="gap-1"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Import Clients ── */}
      {adminStep === "import" && (
        <CsvImportStep onComplete={handleImportComplete} />
      )}

      {/* ── Step 5: Email Setup ── */}
      {adminStep === "email" && (
        <EmailSetupStep onComplete={handleEmailSetupComplete} />
      )}

      {/* ── Step 6: Configuration ── */}
      {adminStep === "config" && sendHour !== null && emailSettings !== null && inboundMode !== null && (
        <div className="space-y-4">
          <ConfigStep
            defaultSendHour={sendHour}
            defaultEmailSettings={emailSettings}
            defaultInboundMode={inboundMode}
            onComplete={handleConfigComplete}
            orgDomain={orgDomain}
            orgInboundAddress={orgInboundAddress}
          />
          {isCompleting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Completing setup...
            </div>
          )}
          {completeError && (
            <p className="text-sm text-destructive">{completeError}</p>
          )}
        </div>
      )}

      {adminStep === "config" && (sendHour === null || emailSettings === null || inboundMode === null) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Step 7: Complete ── */}
      {adminStep === "complete" && (
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="size-8 text-green-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Setup complete!
              </h1>
              <p className="text-muted-foreground">
                Your firm is set up and ready to go. Start managing client
                deadlines and sending reminders from your dashboard.
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-3">
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
            </CardContent>
          </Card>

          <Button
            className="w-full active:scale-[0.97]"
            onClick={() => { window.location.href = dashboardUrl; }}
          >
            Go to Dashboard
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
