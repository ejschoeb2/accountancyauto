"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SignOutCard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  function handleSignOut() {
    setIsLoading(true);
    router.push("/auth/signout");
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-muted shrink-0">
          <LogOut className="size-6 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Sign Out</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Sign out of your account and return to the login page
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <LogOut className="size-4 mr-2" />
              )}
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
