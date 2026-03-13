"use client";

import { useState } from "react";
import { Loader2, CheckCircle, ArrowLeft, ArrowRight, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketingNav } from "@/components/marketing/nav";
import { forgotPassword } from "../login/actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await forgotPassword(email);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setEmailSent(true);
      setIsLoading(false);
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MarketingNav hideLogin signupLabel="Create account" signupBlue />
        <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">

          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="size-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
                <p className="text-sm text-muted-foreground">
                  We&apos;ve sent a password reset link to{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </p>
                <p className="text-sm text-muted-foreground">
                  The link expires in 24 hours.
                </p>
              </div>
            </div>
          </div>

          <a
            href="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </a>

        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MarketingNav hideLogin signupLabel="Create account" signupBlue />
      <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Card box */}
        <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">

          {/* Brand */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 rounded-xl">
                <AlertCircle className="size-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-500">{error}</p>
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

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  <>
                    Send reset link
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        <a
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </a>

      </div>
      </div>
    </div>
  );
}
