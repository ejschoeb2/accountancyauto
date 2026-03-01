"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";
import { MarketingNav } from "@/components/marketing/nav";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlError = searchParams?.get("error");
  const urlMessage = searchParams?.get("message");
  const inviteToken = searchParams?.get("invite") ?? undefined;
  const inviteOrg = searchParams?.get("org") ?? undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn(email, password, inviteToken);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    }
    // On success, signIn() calls redirect() server-side — no client handling needed
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
            <h1 className="text-2xl font-bold tracking-tight">
              {inviteOrg ? `Sign in to join ${inviteOrg}` : "Sign in to Prompt"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {inviteOrg
                ? "Enter your credentials and you'll be taken straight to the invite."
                : "Enter your email and password to continue"}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {urlMessage && (
              <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-700">
                {urlMessage}
              </div>
            )}
            {(error || urlError) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {error ||
                  (urlError === "auth_failed" && "Authentication failed. Please try again.") ||
                  "An error occurred. Please try again."}
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</Label>
                  <a
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
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

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
