"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonBase } from "@/components/ui/button-base";
import { startSignup, verifyEmailOtp, resendEmailOtp } from "../actions";

interface AccountSetupStepProps {
  onComplete: () => void;
}

type SubStep = "details" | "verify";

export function AccountSetupStep({ onComplete }: AccountSetupStepProps) {
  const [subStep, setSubStep] = useState<SubStep>("details");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const result = await startSignup(email, password);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.alreadyConfirmed) {
      // Email confirmation disabled (dev/test) — skip OTP step
      onComplete();
    } else {
      setSubStep("verify");
      startResendCooldown();
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const result = await verifyEmailOtp(email, otp);
    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onComplete();
    }
  }

  async function handleResend() {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setResendMessage(null);
    setError(null);

    const result = await resendEmailOtp(email);
    setIsResending(false);

    if (result.error) {
      setError(result.error);
    } else {
      setResendMessage("Code sent — check your inbox.");
      startResendCooldown();
    }
  }

  function startResendCooldown() {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // ── Verify sub-step ────────────────────────────────────────────────────────
  if (subStep === "verify") {
    return (
      <div className="max-w-md mx-auto space-y-4 min-h-[520px]">
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Enter it below to verify your account.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          {resendMessage && !error && (
            <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700">
              {resendMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="otp"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                Verification code
              </Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                required
                disabled={isLoading}
                autoComplete="one-time-code"
                className="text-center text-2xl tracking-[0.4em] font-mono"
                autoFocus
              />
            </div>

            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={handleVerify as unknown as React.MouseEventHandler}
              disabled={isLoading || otp.length < 6}
            >
              {isLoading ? (
                <><Loader2 className="size-4 animate-spin" /> Verifying...</>
              ) : (
                <>Verify email <ArrowRight className="size-4" /></>
              )}
            </ButtonBase>
          </form>

          <div className="flex flex-col items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {isResending
                ? "Sending..."
                : resendCooldown > 0
                ? `Send again in ${resendCooldown}s`
                : "Send code again"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSubStep("details");
                setOtp("");
                setError(null);
                setResendMessage(null);
              }}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Details sub-step ───────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto space-y-4 min-h-[520px]">
      <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Free for up to 25 clients, no card required.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="confirmPassword"
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
            >
              Confirm password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <ButtonBase
            variant="green"
            buttonType="icon-text"
            onClick={handleSignup as unknown as React.MouseEventHandler}
            disabled={isLoading || !email || !password || !confirmPassword}
          >
            {isLoading ? (
              <><Loader2 className="size-4 animate-spin" /> Creating account...</>
            ) : (
              <>Continue <ArrowRight className="size-4" /></>
            )}
          </ButtonBase>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="text-foreground hover:underline font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
