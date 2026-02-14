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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/logofini.png"
              alt="Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <div className="w-px h-12 bg-border" />
            <Image
              src="/peninsulaccountinglogo.jpg"
              alt="Peninsula Accounting"
              width={140}
              height={48}
              className="object-contain"
            />
          </div>
          <div className="text-center space-y-2 mt-4">
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome to Peninsula Accounting
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
                disabled={isLoading || isDemoLoading}
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || isDemoLoading || !email}
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button
            onClick={handleDemoLogin}
            disabled={isLoading || isDemoLoading}
            variant="outline"
            className="w-full h-12 text-base"
          >
            {isDemoLoading ? (
              <>
                <Loader2 className="size-5 mr-2 animate-spin" />
                Signing in to demo...
              </>
            ) : (
              <>
                <Play className="size-5 mr-2" />
                Try Demo
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Demo: Explore with sample data (no account needed)
            </p>
          </div>
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
