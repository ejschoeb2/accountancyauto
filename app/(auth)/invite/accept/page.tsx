"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brain, Loader2, CheckCircle, AlertCircle, Users, ArrowRight } from "lucide-react";
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
        window.location.href = `/setup/wizard?org=${orgSlug}`;
      } else {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.accountants";
        const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
        window.location.href = `https://${orgSlug}.app.${baseDomain}/setup/wizard`;
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
          <div className="flex items-center gap-2">
            <Brain className="text-violet-600" size={28} />
            <span className="text-2xl font-bold tracking-tight">Prompt</span>
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
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-4 text-center">
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
          </div>
        )}

        {/* ── Unauthenticated — token valid but user not signed in ── */}
        {pageState === "unauthenticated" && orgName && (
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
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

            <div className="space-y-3">
              <Link
                href={`/signup?invite=${encodeURIComponent(token)}&org=${encodeURIComponent(orgName)}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
              >
                Create an account to join
                <ArrowRight size={15} />
              </Link>
              <Link
                href={`/login?invite=${encodeURIComponent(token)}&org=${encodeURIComponent(orgName)}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-3 text-sm font-semibold hover:bg-accent active:scale-95 transition-all duration-200"
              >
                Sign in to an existing account
              </Link>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              After signing in or creating an account, you&apos;ll be taken straight back here to accept.
            </p>
          </div>
        )}

        {/* ── Ready to accept ── */}
        {pageState === "ready" && orgName && (
          <div className="rounded-2xl border bg-card shadow-sm p-8 space-y-6">
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

            <button
              onClick={handleAccept}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
            >
              Accept &amp; Join {orgName}
              <ArrowRight size={15} />
            </button>

            <p className="text-xs text-muted-foreground text-center">
              By accepting, you&apos;ll join the {orgName} workspace on Prompt.
            </p>
          </div>
        )}

        {/* ── Accepting (loading state) ── */}
        {pageState === "accepting" && (
          <div className="rounded-2xl border bg-card shadow-sm p-8 text-center space-y-4">
            <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Joining {orgName}...
            </p>
          </div>
        )}

        {/* ── Error accepting ── */}
        {pageState === "error" && (
          <div className="rounded-2xl border bg-card shadow-sm p-8 text-center space-y-4">
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
            <button
              onClick={() => {
                setPageState("ready");
                setErrorMessage(null);
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-3 text-sm font-semibold hover:bg-accent active:scale-95 transition-all duration-200"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Success (fallback — normally redirected immediately) ── */}
        {pageState === "success" && (
          <div className="rounded-2xl border bg-card shadow-sm p-8 text-center space-y-4">
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
            <Link
              href="/login"
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
            >
              Go to Dashboard
              <ArrowRight size={15} />
            </Link>
          </div>
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
