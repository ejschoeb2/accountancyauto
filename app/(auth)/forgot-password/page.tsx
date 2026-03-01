"use client";

import { useState } from "react";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
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
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} />
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
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

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          </div>

        </div>

        {/* Outside the box */}
        <a
          href="/login"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </a>
      </div>
    </div>
  );
}
