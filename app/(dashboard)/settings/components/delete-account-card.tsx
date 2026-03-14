"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DeleteAccountCard() {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete account");
        setLoading(false);
        setDialogOpen(false);
        return;
      }

      // Redirect to homepage after deletion
      window.location.href = "/";
    } catch (err) {
      console.error("Delete account error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
      setDialogOpen(false);
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-red-500/10 shrink-0">
          <Trash2 className="size-6 text-red-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Delete Account</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete your account, organisation, and all associated data
              </p>
            </div>
            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <AlertDialogTrigger asChild>
                <ButtonBase variant="destructive" buttonType="icon-text">
                  <Trash2 className="size-4" />
                  Delete account
                </ButtonBase>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action is permanent and cannot be undone. All your data will
                    be deleted, including your clients, email logs, templates, and
                    any active subscription will be cancelled.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={loading}>
                    Keep my account
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAccount();
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Yes, delete my account"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {error && (
            <p className="text-sm font-medium text-status-danger mt-2">{error}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
