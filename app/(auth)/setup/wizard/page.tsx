"use client";

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
import { PortalSetupStep } from "./components/portal-setup-step";
import { AccountSetupStep } from "./components/account-setup-step";
import { DeadlineSelectionStep } from "./components/deadline-selection-step";
import type { PlanTier } from "@/lib/stripe/plans";

import { useWizardState } from "./use-wizard-state";
import {
  PLAN_TIERS,
  MEMBER_STEPS,
  getAdminStepperSteps,
  adminStepToIndex,
} from "./wizard-steps";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const w = useWizardState();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (w.isCheckingAuth || w.userType === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Invited-member path ────────────────────────────────────────────────────
  if (w.userType === "invited-member") {
    return (
      <div className="space-y-12">
        <WizardStepper
          steps={MEMBER_STEPS}
          currentStep={w.memberStep}
          onStepClick={(index) => w.setMemberStep(index)}
        />

        {w.memberStep === 0 && (
          <div className="min-h-[520px]">
            <CsvImportStep
              onComplete={w.handleImportComplete}
              initialRows={w.savedImportRows ?? undefined}
              onRowsChange={w.handleImportRowsChange}
            />
          </div>
        )}

        {w.memberStep === 1 && w.sendHour !== null && w.emailSettings !== null && (
          <div className="min-h-[520px]">
            <ConfigStep
              defaultSendHour={w.sendHour}
              defaultEmailSettings={w.emailSettings}
              onComplete={w.handleConfigComplete}
              onBack={() => w.setMemberStep(0)}
              orgDomain={w.orgDomain}
              isMember
              isCompleting={w.isCompleting}
              completeError={w.completeError}
            />
          </div>
        )}

        {w.memberStep === 1 && (w.sendHour === null || w.emailSettings === null) && (
          <div className="flex items-center justify-center min-h-[520px]">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {w.memberStep === 2 && (
          <MemberCompleteStep
            onGoToDashboard={w.handleGoToDashboard}
            isLeavingWizard={w.isLeavingWizard}
          />
        )}
      </div>
    );
  }

  // ── New-admin path ─────────────────────────────────────────────────────────
  const adminSteps = getAdminStepperSteps(w.isJoiningExistingOrg);
  const currentStepIndex = adminStepToIndex(w.adminStep, w.isJoiningExistingOrg);

  return (
    <div className="space-y-12">
      <WizardStepper
        steps={adminSteps}
        currentStep={currentStepIndex}
        onStepClick={w.handleStepperClick}
      />

      {/* Step: Email verification */}
      {w.adminStep === "account" && (
        <AccountSetupStep
          onComplete={w.handleAccountComplete}
          initialEmail={sessionStorage.getItem("wizard_pending_email") ?? undefined}
          initialSubStep="verify"
        />
      )}

      {/* Step: Firm Details */}
      {w.adminStep === "firm" && (
        <FirmStep
          firmName={w.firmName}
          slug={w.slug}
          slugStatus={w.slugStatus}
          slugReason={w.slugReason}
          firmError={w.firmError}
          onFirmNameChange={w.handleFirmNameChange}
          onSlugChange={w.handleSlugChange}
          onContinue={w.handleFirmContinue}
        />
      )}

      {/* Step: Plan Selection */}
      {w.adminStep === "plan" && (
        <PlanStep
          selectedTier={w.selectedTier}
          setSelectedTier={w.setSelectedTier}
          isCreatingOrg={w.isCreatingOrg}
          orgCreated={w.orgCreated}
          planError={w.planError}
          setPlanError={w.setPlanError}
          onBack={() => w.advanceToStep("firm")}
          onNext={w.handlePlanNext}
        />
      )}

      {/* Step: Deadline Selection */}
      {w.adminStep === "deadlines" && (
        <div className="min-h-[520px]">
          <DeadlineSelectionStep
            onComplete={w.handleDeadlinesComplete}
            onBack={() => {
              if (w.isJoiningExistingOrg) return;
              w.advanceToStep("plan");
            }}
            initialSelection={w.deadlineSelections}
            initialClientTypes={w.selectedClientTypes}
            initialDisabledDocuments={w.disabledDocuments}
          />
        </div>
      )}

      {/* Step: Import Clients */}
      {w.adminStep === "import" && (
        <div className="min-h-[520px]">
          <CsvImportStep
            onComplete={w.handleImportComplete}
            onBack={() => w.advanceToStep("deadlines")}
            initialRows={w.savedImportRows ?? undefined}
            onRowsChange={w.handleImportRowsChange}
            planClientLimit={
              w.selectedTier
                ? PLAN_TIERS.find((p) => p.key === w.selectedTier)?.clientLimit ?? null
                : null
            }
            selectedClientTypes={w.selectedClientTypes}
          />
        </div>
      )}

      {/* Step: Email Setup */}
      {w.adminStep === "email" && w.sendHour !== null && w.emailSettings !== null && (
        <div className="min-h-[520px]">
          <EmailSetupStep
            onComplete={w.handleConfigComplete}
            onBack={() => w.advanceToStep("import")}
            defaultSendHour={w.sendHour}
            defaultEmailSettings={w.emailSettings}
            orgDomain={w.orgDomain}
            isCompleting={w.isCompleting}
            completeError={w.completeError}
            initialState={w.emailInitialSubStep}
          />
        </div>
      )}
      {w.adminStep === "email" && (w.sendHour === null || w.emailSettings === null) && (
        <div className="flex items-center justify-center min-h-[520px]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Step: Client Portal */}
      {w.adminStep === "portal" && (
        <div className="min-h-[520px]">
          <PortalSetupStep
            onComplete={w.handlePortalComplete}
            onBack={() => w.advanceToStep("email")}
            initialPortalSelection={w.portalSelection}
            initialPart={w.portalSubStep}
            initialUploadCheckMode={w.uploadCheckSelection}
            initialAutoReceive={w.autoReceiveSelection}
            initialRejectMismatched={w.rejectMismatchedSelection}
            storageConnected={w.storageConnected}
            storageError={w.storageError}
            onBeforeStorageConnect={w.handleBeforeStorageConnect}
          />
        </div>
      )}

      {/* Step: Complete */}
      {w.adminStep === "complete" && (
        <AdminCompleteStep
          selectedTier={w.selectedTier}
          isJoiningExistingOrg={w.isJoiningExistingOrg}
          completeError={w.completeError}
          isLeavingWizard={w.isLeavingWizard}
          onBack={() => w.advanceToStep(w.isJoiningExistingOrg ? "email" : "portal")}
          onGoToDashboard={w.handleGoToDashboard}
        />
      )}
    </div>
  );
}

// ─── Sub-components (keep co-located — only used by this page) ───────────────

function MemberCompleteStep({
  onGoToDashboard,
  isLeavingWizard,
}: {
  onGoToDashboard: () => void;
  isLeavingWizard: boolean;
}) {
  return (
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
        onClick={onGoToDashboard}
        disabled={isLeavingWizard}
      >
        {isLeavingWizard ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
        Go to Dashboard
        <ArrowRight className="size-4 ml-2" />
      </Button>
    </div>
  );
}

function FirmStep({
  firmName,
  slug,
  slugStatus,
  slugReason,
  firmError,
  onFirmNameChange,
  onSlugChange,
  onContinue,
}: {
  firmName: string;
  slug: string;
  slugStatus: "idle" | "checking" | "available" | "unavailable";
  slugReason: string | null;
  firmError: string | null;
  onFirmNameChange: (v: string) => void;
  onSlugChange: (v: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="max-w-md mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Tell us about your firm
          </h1>
          <p className="text-sm text-muted-foreground">
            Your firm name and URL slug are used to set up your private workspace.
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="firmName" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Firm name</Label>
            <Input
              id="firmName"
              placeholder="Acme Accounting Ltd"
              value={firmName}
              onChange={(e) => onFirmNameChange(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">URL slug</Label>
            {!slug && (
              <p className="text-xs text-muted-foreground">
                Enter your firm name above to auto-suggest a slug, or type your own.
              </p>
            )}
            <div className="flex-1 relative">
              <Input
                id="slug"
                placeholder="acme-accounting"
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
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
          </div>

          {firmError && (
            <p className="text-sm text-destructive">{firmError}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <ButtonBase
          variant="green"
          buttonType="icon-text"
          onClick={onContinue}
          disabled={!firmName.trim() || slugStatus !== "available"}
        >
          Next Step
          <ArrowRight className="size-4" />
        </ButtonBase>
      </div>
    </div>
  );
}

function PlanStep({
  selectedTier,
  setSelectedTier,
  isCreatingOrg,
  orgCreated,
  planError,
  setPlanError,
  onBack,
  onNext,
}: {
  selectedTier: PlanTier | null;
  setSelectedTier: (t: PlanTier) => void;
  isCreatingOrg: boolean;
  orgCreated: boolean;
  planError: string | null;
  setPlanError: (e: string | null) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="max-w-5xl mx-auto space-y-4 min-h-[520px]">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

        <p className="text-xs text-muted-foreground/60 text-center">All prices exclude VAT.</p>
      </div>

      <div className="flex justify-end gap-2">
        {!orgCreated && (
          <ButtonBase
            variant="amber"
            buttonType="icon-text"
            onClick={onBack}
            disabled={isCreatingOrg}
          >
            <ArrowLeft className="size-4" />
            Back
          </ButtonBase>
        )}
        <ButtonBase
          variant="green"
          buttonType="icon-text"
          onClick={onNext}
          disabled={!selectedTier || isCreatingOrg}
        >
          {isCreatingOrg ? (
            <><Loader2 className="size-4 animate-spin" /> Processing...</>
          ) : (
            <>Next Step <ArrowRight className="size-4" /></>
          )}
        </ButtonBase>
      </div>
    </div>
  );
}

function AdminCompleteStep({
  selectedTier,
  isJoiningExistingOrg,
  completeError,
  isLeavingWizard,
  onBack,
  onGoToDashboard,
}: {
  selectedTier: PlanTier | null;
  isJoiningExistingOrg: boolean;
  completeError: string | null;
  isLeavingWizard: boolean;
  onBack: () => void;
  onGoToDashboard: () => void;
}) {
  const isPaid = selectedTier && selectedTier !== "free";
  const planInfo = PLAN_TIERS.find((p) => p.key === selectedTier);

  return (
    <div className="max-w-md mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {isJoiningExistingOrg ? "You\u2019re all set!" : "Setup complete!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isJoiningExistingOrg
              ? "Your account is configured and ready to go. You can start managing client reminders from your dashboard."
              : isPaid
                ? "Your firm is configured. Complete your subscription to get started."
                : "Your firm is set up and ready to go. Start managing client deadlines and sending reminders from your dashboard."}
          </p>
        </div>

        <div className="space-y-3">
          {!isJoiningExistingOrg && (
            <>
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">Firm workspace created</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="size-4 text-green-600 shrink-0" />
                <span className="text-sm">
                  {planInfo ? `${planInfo.name} plan selected` : "Plan selected"}
                  {planInfo && planInfo.price ? ` — £${planInfo.price}/mo` : ""}
                </span>
              </div>
            </>
          )}
          <div className="flex items-center gap-3">
            <Check className="size-4 text-green-600 shrink-0" />
            <span className="text-sm">Client data imported</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="size-4 text-green-600 shrink-0" />
            <span className="text-sm">Email settings configured</span>
          </div>
          <div className="flex items-center gap-3">
            <Check className="size-4 text-green-600 shrink-0" />
            <span className="text-sm">Reminder settings saved</span>
          </div>
        </div>

        {completeError && (
          <p className="text-sm text-destructive">{completeError}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <ButtonBase
          variant="amber"
          buttonType="icon-text"
          onClick={onBack}
          disabled={isLeavingWizard}
        >
          <ArrowLeft className="size-4" />
          Back
        </ButtonBase>
        <ButtonBase
          variant="green"
          buttonType="icon-text"
          onClick={onGoToDashboard}
          disabled={isLeavingWizard}
        >
          {isLeavingWizard ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isPaid ? (
            <>Subscribe & Go to Dashboard <ArrowRight className="size-4" /></>
          ) : (
            <>Go to Dashboard <ArrowRight className="size-4" /></>
          )}
        </ButtonBase>
      </div>

      {isPaid && !isLeavingWizard && (
        <p className="text-xs text-muted-foreground text-center">
          You&apos;ll be redirected to Stripe to complete payment.
        </p>
      )}
    </div>
  );
}
