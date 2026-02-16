"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, Mail, Play, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink, signInAsDemo } from "./actions";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Check if this is a demo deployment
  const isDemo = process.env.NEXT_PUBLIC_IS_DEMO === "true";

  // Check for error from URL params
  const urlError = searchParams?.get("error");

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await sendMagicLink(email);

    if (result?.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      setMagicLinkSent(true);
      setIsLoading(false);
    }
  }

  async function handleDemoLogin() {
    setIsDemoLoading(true);
    setError(null);

    const result = await signInAsDemo();

    if (result?.error) {
      setError(result.error);
      setIsDemoLoading(false);
    } else {
      // Success - server action redirects
      router.refresh();
    }
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="size-8 text-green-600" />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                Check your email
              </h1>
              <p className="text-muted-foreground">
                We've sent a login link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Click the link in the email to sign in. You can close this window.
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setMagicLinkSent(false);
                setEmail("");
              }}
            >
              Send another link
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Demo deployment: simplified "Enter Demo" page
  if (isDemo) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card container with hover effect */}
          <div className="group rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow duration-200 p-8">
            {/* Branding */}
            <div className="flex flex-col items-center gap-6 mb-6">
              <Image
                src="/logofini.png"
                alt="Logo"
                width={54}
                height={54}
                className="object-contain"
              />
              <div className="text-center space-y-1">
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome to PhaseTwo
                </h1>
                <p className="text-sm text-muted-foreground">
                  Explore with sample data
                </p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-sm text-status-danger mb-4">
                {error}
              </div>
            )}

            {/* Demo Login Button */}
            <Button
              onClick={handleDemoLogin}
              disabled={isDemoLoading}
              className="w-full h-12 text-base bg-status-info hover:bg-status-info/90 text-white"
            >
              {isDemoLoading ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" />
                  Loading demo...
                </>
              ) : (
                <>
                  <Play className="size-5 mr-2" />
                  Enter Demo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Real deployment: normal login flow (no demo button)
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/logofini.png"
            alt="Logo"
            width={64}
            height={64}
            className="object-contain"
          />
          <div className="text-center space-y-2 mt-4">
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to PhaseTwo
            </h1>
            <p className="text-muted-foreground">
              Sign in with your email to get started
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="space-y-4">
          {(error || urlError) && (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-sm text-status-danger">
              {error || (urlError === "auth_failed" && "Authentication failed. Please try again.") || "An error occurred. Please try again."}
            </div>
          )}

          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full h-12 text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-5 mr-2 animate-spin" />
                  Sending link...
                </>
              ) : (
                <>
                  <Mail className="size-5 mr-2" />
                  Send login link
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
