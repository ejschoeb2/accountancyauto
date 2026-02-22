"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reassignClients } from "@/app/actions/clients";

export interface AccountantStats {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  clientCount: number;
}

interface AccountantOverviewCardProps {
  accountants: AccountantStats[];
  totalClients: number;
  clientLimit: number | null;
}

export function AccountantOverviewCard({
  accountants,
  totalClients,
  clientLimit,
}: AccountantOverviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null); // fromUserId being reassigned
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showReassignColumn = accountants.length > 1;

  function handleReassign(fromUserId: string, toUserId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPendingAction(fromUserId);

    startTransition(async () => {
      const result = await reassignClients(fromUserId, toUserId);
      setPendingAction(null);

      if (result.error) {
        setErrorMessage(result.error);
      } else {
        setSuccessMessage(
          `${result.reassigned ?? 0} client${result.reassigned === 1 ? "" : "s"} reassigned.`
        );
        router.refresh();
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="flex items-center justify-center size-12 rounded-lg bg-blue-500/10 shrink-0">
          <Users className="size-6 text-blue-500" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Accountant Overview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Client distribution across your team
            </p>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{accountants.length}</span>{" "}
              {accountants.length === 1 ? "accountant" : "accountants"}
            </span>
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{totalClients}</span>{" "}
              {totalClients === 1 ? "client" : "clients"}
              {clientLimit !== null ? ` / ${clientLimit}` : " (unlimited)"}
            </span>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <p className="text-sm font-medium text-destructive">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="text-sm font-medium text-green-600">{successMessage}</p>
          )}

          {/* Accountant table */}
          {accountants.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No accountants found.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border">
              {/* Table header */}
              <div
                className={`grid gap-3 px-4 py-2 bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                  showReassignColumn ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]"
                }`}
              >
                <span>Accountant</span>
                <span>Role</span>
                <span className="text-right">Clients</span>
                {showReassignColumn && <span>Actions</span>}
              </div>

              {/* Table rows */}
              {accountants.map((accountant) => {
                const isRowPending = isPending && pendingAction === accountant.userId;
                const otherAccountants = accountants.filter(
                  (a) => a.userId !== accountant.userId
                );

                return (
                  <div
                    key={accountant.userId}
                    className={`grid gap-3 px-4 py-3 items-center ${
                      showReassignColumn
                        ? "grid-cols-[1fr_auto_auto_auto]"
                        : "grid-cols-[1fr_auto_auto]"
                    }`}
                  >
                    {/* Name / email */}
                    <div className="min-w-0">
                      {accountant.name && accountant.name !== accountant.email ? (
                        <>
                          <p className="text-sm font-medium truncate">{accountant.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{accountant.email}</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium truncate">{accountant.email}</p>
                      )}
                    </div>

                    {/* Role badge */}
                    <div>
                      {accountant.role === "admin" ? (
                        <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-blue-500/10">
                          <span className="text-xs font-medium text-blue-500">Admin</span>
                        </div>
                      ) : (
                        <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-status-neutral/10">
                          <span className="text-xs font-medium text-status-neutral">Member</span>
                        </div>
                      )}
                    </div>

                    {/* Client count */}
                    <span className="text-sm tabular-nums text-right">
                      {accountant.clientCount}
                    </span>

                    {/* Reassign action */}
                    {showReassignColumn && (
                      <div>
                        {accountant.clientCount > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isRowPending || isPending}
                              >
                                {isRowPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  "Reassign"
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="text-xs">
                                Move all clients to:
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {otherAccountants.map((target) => (
                                <DropdownMenuItem
                                  key={target.userId}
                                  onClick={() =>
                                    handleReassign(accountant.userId, target.userId)
                                  }
                                >
                                  <span className="truncate max-w-[200px]">
                                    {target.name && target.name !== target.email
                                      ? target.name
                                      : target.email}
                                  </span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
