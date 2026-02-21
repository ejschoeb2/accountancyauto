"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, CheckCircle, AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { validateInviteToken, acceptInvite } from "./actions";

type PageState =
  | "loading"         // initial load: checking token + auth
  | "invalid"         // token is invalid or expired
  | "unauthenticated" // token valid but user not signed in
  | "ready"           // authenticated, valid token — show accept button
  | "accepting"       // processing accept
  | "success"         // accepted successfully
  | "error";          // accept failed

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [pageState, setPageState] = useState<PageState>("loading");
  const [orgName, setOrgName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      // 1. Validate token first (regardless of auth state)
      const validation = await validateInviteToken(token);

      if (!validation.valid) {
        setErrorMessage(
          validation.error ?? "This invite link is invalid or has expired."
        );
        setPageState("invalid");
        return;
      }

      setOrgName(validation.orgName ?? null);
      setRole(validation.role ?? null);

      // 2. Check auth state
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPageState("unauthenticated");
      } else {
        setPageState("ready");
      }
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAccept = async () => {
    setPageState("accepting");
    setErrorMessage(null);

    const result = await acceptInvite(token);

    if (result.error) {
      setErrorMessage(result.error);
      setPageState("error");
      return;
    }

    // Refresh session so the JWT hook fires with the new org_id
    await supabase.auth.refreshSession();

    const orgSlug = result.orgSlug;
    const isDev =
      typeof window !== "undefined" && window.location.hostname === "localhost";

    if (orgSlug) {
      if (isDev) {
        window.location.href = `/?org=${orgSlug}`;
      } else {
        window.location.href = `https://${orgSlug}.app.phasetwo.uk/`;
      }
    } else {
      // orgSlug missing — user was added but we couldn't resolve the slug
      setPageState("success");
    }
  };

  const roleLabel =
    role === "admin" ? "Admin" : role === "member" ? "Member" : role ?? "";

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
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">Peninsula Accounting</p>
          </div>
        </div>

        {/* ── Loading ── */}
        {pageState === "loading" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Invalid / Expired token ── */}
        {pageState === "invalid" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-status-danger/10 rounded-full flex items-center justify-center">
                <AlertCircle className="size-6 text-status-danger" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Invite link invalid
                </h1>
                <p className="text-sm text-muted-foreground">
                  {errorMessage ??
                    "This invite link is invalid or has expired. Please ask the person who invited you to send a new invite."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Unauthenticated — token valid but user not signed in ── */}
        {pageState === "unauthenticated" && orgName && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="size-6 text-primary" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">
                  You&apos;ve been invited to join {orgName}
                </h1>
                {roleLabel && (
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll be added as a{" "}
                    <span className="font-medium text-foreground">
                      {roleLabel}
                    </span>
                    .
                  </p>
                )}
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Sign in to accept this invite</p>
                <p className="text-sm text-muted-foreground">
                  You need to sign in first. After signing in, click the invite
                  link in your email again to accept and join {orgName}.
                </p>
              </div>

              <Button asChild className="w-full">
                <Link href="/login">Sign In</Link>
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Don&apos;t have an account yet? Sign in with your email and we&apos;ll
                create one for you.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Ready to accept ── */}
        {pageState === "ready" && orgName && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="size-6 text-primary" />
                </div>
                <h1 className="text-xl font-bold tracking-tight">
                  You&apos;ve been invited to join {orgName}
                </h1>
                {roleLabel && (
                  <p className="text-sm text-muted-foreground">
                    You&apos;ll be added as a{" "}
                    <span className="font-medium text-foreground">
                      {roleLabel}
                    </span>
                    .
                  </p>
                )}
              </div>

              <Button
                className="w-full active:scale-[0.97]"
                onClick={handleAccept}
              >
                Accept &amp; Join {orgName}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By accepting, you&apos;ll join the {orgName} workspace on Peninsula
                Accounting.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Accepting (loading state) ── */}
        {pageState === "accepting" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Joining {orgName}...
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Error accepting ── */}
        {pageState === "error" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-status-danger/10 rounded-full flex items-center justify-center">
                <AlertCircle className="size-6 text-status-danger" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Could not accept invite
                </h1>
                <p className="text-sm text-muted-foreground">
                  {errorMessage ?? "Something went wrong. Please try again."}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setPageState("ready");
                  setErrorMessage(null);
                }}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Success (fallback — normally redirected immediately) ── */}
        {pageState === "success" && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle className="size-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight">
                  Welcome to the team!
                </h1>
                <p className="text-sm text-muted-foreground">
                  You&apos;ve successfully joined {orgName}. Sign in to access your
                  dashboard.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Go to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
