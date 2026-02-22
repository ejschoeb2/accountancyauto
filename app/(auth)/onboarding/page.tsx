"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, CheckCircle, Check, X, ArrowLeft, ArrowRight, Building2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { WizardStepper } from "@/components/wizard-stepper";
import { createClient } from "@/lib/supabase/client";
import { PLAN_TIERS } from "@/lib/stripe/plans";
import type { PlanTier } from "@/lib/stripe/plans";
import {
  sendOnboardingMagicLink,
  checkSlugAvailable,
  createOrgAndJoinAsAdmin,
} from "./actions";

type WizardStep = "account" | "firm" | "plan" | "done";

const STEPS = [
  { label: "Account" },
  { label: "Firm Details" },
  { label: "Plan" },
  { label: "Trial Started" },
];

function stepToIndex(step: WizardStep): number {
  switch (step) {
    case "account":
      return 0;
    case "firm":
      return 1;
    case "plan":
      return 2;
    case "done":
      return 3;
  }
}

function slugifyFirmName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(0)}`;
}

export default function OnboardingPage() {
  const [step, setStep] = useState<WizardStep>("account");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Step 1: Account
  const [email, setEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Step 2: Firm Details
  const [firmName, setFirmName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [slugReason, setSlugReason] = useState<string | null>(null);
  const [firmError, setFirmError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3: Plan
  const [selectedTier, setSelectedTier] = useState<PlanTier | null>(null);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Step 4: Done
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [isGoingToDashboard, setIsGoingToDashboard] = useState(false);

  const supabase = createClient();

  // On mount, check if user is already authenticated — skip to Step 2 if so
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setStep("firm");
      }
      setIsCheckingAuth(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced slug availability check
  const checkSlug = useCallback(
    (value: string) => {
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
    },
    []
  );

  const handleFirmNameChange = (value: string) => {
    setFirmName(value);
    // Auto-suggest slug from firm name
    const suggested = slugifyFirmName(value);
    setSlug(suggested);
    checkSlug(suggested);
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    checkSlug(value);
  };

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      setAccountError("Please enter your email address.");
      return;
    }

    setIsSendingLink(true);
    setAccountError(null);

    const result = await sendOnboardingMagicLink(email.trim());

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
    setStep("plan");
  };

  const handleStartTrial = async (tier: PlanTier) => {
    setSelectedTier(tier);
    setIsCreatingOrg(true);
    setPlanError(null);

    try {
      const result = await createOrgAndJoinAsAdmin(firmName, slug, tier);
      setCreatedSlug(result.slug);
      setStep("done");
    } catch (err) {
      setPlanError(
        err instanceof Error ? err.message : "Failed to create organisation. Please try again."
      );
      setSelectedTier(null);
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleGoToDashboard = async () => {
    setIsGoingToDashboard(true);

    // Refresh session so the JWT hook fires with the new org_id in app_metadata
    await supabase.auth.refreshSession();

    const orgSlug = createdSlug;
    const isDev =
      typeof window !== "undefined" && window.location.hostname === "localhost";

    if (isDev) {
      window.location.href = `/?org=${orgSlug}`;
    } else {
      window.location.href = `https://${orgSlug}.app.phasetwo.uk/`;
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stepper */}
      <WizardStepper steps={STEPS} currentStep={stepToIndex(step)} />

      {/* ---- Step 1: Account ---- */}
      {step === "account" && (
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

      {/* ---- Step 2: Firm Details ---- */}
      {step === "firm" && (
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

                {/* Slug status message */}
                {slug && slugStatus === "available" && (
                  <p className="text-xs text-green-600">
                    Your workspace URL: <span className="font-medium">{slug}.app.phasetwo.uk</span>
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
                  onClick={() => setStep("account")}
                  className="gap-1"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={handleFirmContinue}
                  disabled={
                    !firmName.trim() ||
                    slugStatus !== "available"
                  }
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

      {/* ---- Step 3: Plan Selection ---- */}
      {step === "plan" && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Choose your plan
            </h1>
            <p className="text-muted-foreground">
              Start a 14-day free trial. No credit card required.
            </p>
          </div>

          {planError && (
            <p className="text-sm text-destructive text-center">{planError}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["sole_trader", "practice", "firm"] as PlanTier[]).map(
              (tier) => {
                const plan = PLAN_TIERS[tier];
                const isPopular = tier === "practice";
                const isLoading = isCreatingOrg && selectedTier === tier;

                return (
                  <Card
                    key={tier}
                    className={
                      isPopular
                        ? "ring-2 ring-primary relative"
                        : "relative"
                    }
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                          <Sparkles className="size-3" />
                          Popular
                        </span>
                      </div>
                    )}
                    <CardContent className="pt-6 flex flex-col h-full space-y-4">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">
                            {formatPrice(plan.monthlyPrice)}
                          </span>
                          <span className="text-muted-foreground text-sm">
                            /mo
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 flex-1">
                        <p className="text-sm text-muted-foreground">
                          {plan.clientLimit === null
                            ? "Unlimited clients"
                            : `Up to ${plan.clientLimit} clients`}
                        </p>
                        <ul className="space-y-1 pt-2">
                          {plan.features.map((feature) => (
                            <li
                              key={feature}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Check className="size-3.5 text-green-600 shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button
                        className="w-full active:scale-[0.97]"
                        variant={isPopular ? "default" : "outline"}
                        onClick={() => handleStartTrial(tier)}
                        disabled={isCreatingOrg}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Starting trial...
                          </>
                        ) : (
                          "Start Free Trial"
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              }
            )}
          </div>

          <div className="flex justify-start">
            <Button
              variant="ghost"
              onClick={() => setStep("firm")}
              disabled={isCreatingOrg}
              className="gap-1"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 4: Trial Started ---- */}
      {step === "done" && createdSlug && selectedTier && (
        <div className="max-w-md mx-auto text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckCircle className="size-8 text-green-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Your trial has started!
            </h1>
            <p className="text-muted-foreground">
              {firmName} is ready. You have 14 days to explore all features.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  {PLAN_TIERS[selectedTier].name}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Trial period</span>
                <span className="font-medium">14 days remaining</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Your workspace</span>
                <span className="font-medium text-primary">
                  {createdSlug}.app.phasetwo.uk
                </span>
              </div>
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full active:scale-[0.97]"
            onClick={handleGoToDashboard}
            disabled={isGoingToDashboard}
          >
            {isGoingToDashboard ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Loading dashboard...
              </>
            ) : (
              <>
                <Building2 className="size-4 mr-2" />
                Go to Dashboard
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
