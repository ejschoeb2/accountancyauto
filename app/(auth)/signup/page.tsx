"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, CheckCircle, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "../login/actions";
import { MarketingNav } from "@/components/marketing/nav";

function SignupForm() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams?.get("invite") ?? undefined;
  const inviteOrg = searchParams?.get("org") ?? undefined;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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

    const result = await signUp(email, password, inviteToken);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    } else if (result?.success) {
      setEmailSent(true);
      setIsLoading(false);
    }
    // If no result (redirect happened), loading stays true while navigation occurs
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MarketingNav hideSignup />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-4 text-center">
              <div className="mx-auto size-14 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="size-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent a confirmation link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                  Click it to activate your account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingNav hideSignup />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Card box */}
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">

          {/* Brand */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {inviteOrg ? `Create an account to join ${inviteOrg}` : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {inviteOrg ? "You'll be taken straight to the invite after signing up." : "Free for up to 25 clients, no card required"}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email address</Label>
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
                <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
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
                <Label htmlFor="confirmPassword" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Confirm password</Label>
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

              <button
                type="submit"
                disabled={isLoading || !email || !password || !confirmPassword}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
