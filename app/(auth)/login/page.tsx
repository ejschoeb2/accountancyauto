"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateQuickBooksOAuth } from "@/app/actions/quickbooks";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleQuickBooksLogin() {
    setIsLoading(true);
    setError(null);

    try {
      const authUrl = await initiateQuickBooksOAuth();
      window.location.href = authUrl;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to initiate QuickBooks login"
      );
      setIsLoading(false);
    }
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
              Sign in with your QuickBooks account to get started
            </p>
          </div>
        </div>

        {/* Login Button */}
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-sm text-status-danger">
              {error}
            </div>
          )}

          <Button
            onClick={handleQuickBooksLogin}
            disabled={isLoading}
            className="w-full h-12 text-base"
            style={{ backgroundColor: "#0077C5" }}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-5 mr-2 animate-spin" />
                Connecting to QuickBooks...
              </>
            ) : (
              <>
                <svg
                  className="size-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M15.5 0C13 0 11 2 11 4.5V11H4.5C2 11 0 13 0 15.5S2 20 4.5 20H11v3.5c0 .3.2.5.5.5s.5-.2.5-.5V20h7.5c2.5 0 4.5-2 4.5-4.5S22 11 19.5 11H12V4.5c0-2 1.5-3.5 3.5-3.5s3.5 1.5 3.5 3.5v.5c0 .3.2.5.5.5s.5-.2.5-.5V4.5C20 2 18 0 15.5 0zM4.5 19C2.6 19 1 17.4 1 15.5S2.6 12 4.5 12H11v3.5c0 2-1.5 3.5-3.5 3.5H4.5zm15 0H12v-7h7.5c1.9 0 3.5 1.6 3.5 3.5S21.4 19 19.5 19z" />
                </svg>
                Sign in with QuickBooks
              </>
            )}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <p>
              Your QuickBooks credentials are used to authenticate and sync
              client data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
