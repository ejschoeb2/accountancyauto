"use client";

/**
 * /oauth-complete
 *
 * Lightweight page that the OAuth callback redirects to when the flow
 * runs inside a popup window. It reads the result from query params,
 * posts it back to the opener via postMessage, and closes the popup.
 *
 * If the user navigates here directly (no opener), it redirects to the
 * settings page as a fallback.
 */

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function OAuthCompleteInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const connected = searchParams.get("connected");
  const error = searchParams.get("error");

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage(
        { type: "oauth-complete", connected, error },
        window.location.origin,
      );
      window.close();
    } else {
      // Not in a popup — redirect to settings as fallback
      const params = new URLSearchParams();
      params.set("tab", "storage");
      if (connected) params.set("connected", connected);
      if (error) params.set("error", error);
      router.replace(`/settings?${params.toString()}`);
    }
  }, [connected, error, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Completing connection...</p>
    </div>
  );
}

export default function OAuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <OAuthCompleteInner />
    </Suspense>
  );
}
