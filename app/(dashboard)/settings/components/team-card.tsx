"use client";

import { useState, useCallback, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Users,
  UserPlus,
  ArrowLeftRight,
  Trash2,
  RotateCcw,
  Ban,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonBase } from "@/components/ui/button-base";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getTeamMembers,
  sendInvite,
  removeTeamMember,
  changeRole,
  cancelInvite,
  resendInvite,
  type TeamMember,
} from "@/app/actions/team";
import { reassignClients } from "@/app/actions/clients";

// ── Types ────────────────────────────────────────────────────────────

export interface AccountantStats {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  clientCount: number;
}

interface TeamCardProps {
  accountants: AccountantStats[];
  totalClients: number;
  clientLimit: number | null;
}

// ── Role badge (inline div+span pattern from DESIGN.md) ─────────────

function RoleBadge({ role }: { role: "admin" | "member" }) {
  if (role === "admin") {
    return (
      <div className="px-3 py-2 rounded-md inline-flex items-center bg-blue-500/10">
        <span className="text-sm font-medium text-blue-500">Admin</span>
      </div>
    );
  }
  return (
    <div className="px-3 py-2 rounded-md inline-flex items-center bg-status-neutral/10">
      <span className="text-sm font-medium text-status-neutral">Member</span>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "pending" }) {
  if (status === "pending") {
    return (
      <div className="px-3 py-2 rounded-md inline-flex items-center bg-amber-500/10">
        <span className="text-sm font-medium text-amber-600">Pending</span>
      </div>
    );
  }
  return (
    <div className="px-3 py-2 rounded-md inline-flex items-center bg-green-500/10">
      <span className="text-sm font-medium text-green-600">Active</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function TeamCard({ accountants, totalClients, clientLimit }: TeamCardProps) {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [isInviting, startInviteTransition] = useTransition();
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Role change dialog state
  const [roleDialog, setRoleDialog] = useState<{ member: TeamMember; newRole: "admin" | "member" } | null>(null);
  const [isChangingRole, startChangeRoleTransition] = useTransition();
  const [roleDialogError, setRoleDialogError] = useState<string | null>(null);

  // Remove member dialog state
  const [removeDialog, setRemoveDialog] = useState<TeamMember | null>(null);
  const [isRemoving, startRemoveTransition] = useTransition();
  const [removeDialogError, setRemoveDialogError] = useState<string | null>(null);

  // Per-row pending action state (resend/cancel)
  const [pendingAction, setPendingAction] = useState<{ id: string; action: "resend" | "cancel" } | null>(null);
  const [resendMessages, setResendMessages] = useState<Record<string, string>>({});

  // Reassign state
  const [isReassigning, startReassignTransition] = useTransition();
  const [reassignPending, setReassignPending] = useState<string | null>(null);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignSuccess, setReassignSuccess] = useState<string | null>(null);

  // Build a lookup map from accountants prop for client counts and display names
  const accountantMap = useMemo(() => {
    const map = new Map<string, { name: string | null; clientCount: number }>();
    for (const a of accountants) {
      map.set(a.userId, { name: a.name, clientCount: a.clientCount });
    }
    return map;
  }, [accountants]);

  const activeMembers = members.filter((m) => m.status === "active" && m.userId);
  const showReassign = activeMembers.length > 1;

  const refreshMembers = useCallback(async () => {
    try {
      const data = await getTeamMembers();
      setMembers(data);
    } catch (err) {
      console.error("TeamCard: failed to load team members:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMembers();
  }, [refreshMembers]);

  // ── Invite handler ───────────────────────────────────────────────

  function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteMessage(null);

    startInviteTransition(async () => {
      const result = await sendInvite(inviteEmail.trim(), inviteRole);
      if (result.error) {
        setInviteMessage({ type: "error", text: result.error });
      } else {
        setInviteMessage({ type: "success", text: "Invite sent successfully." });
        setInviteEmail("");
        setInviteRole("member");
        await refreshMembers();
        setTimeout(() => setInviteMessage(null), 4000);
      }
    });
  }

  // ── Role change handler ─────────────────────────────────────────

  function openRoleDialog(member: TeamMember) {
    setRoleDialog({
      member,
      newRole: member.role === "admin" ? "member" : "admin",
    });
    setRoleDialogError(null);
  }

  function handleConfirmRoleChange() {
    if (!roleDialog) return;
    setRoleDialogError(null);

    startChangeRoleTransition(async () => {
      const result = await changeRole(roleDialog.member.userId!, roleDialog.newRole);
      if (result.error) {
        setRoleDialogError(result.error);
      } else {
        setRoleDialog(null);
        await refreshMembers();
      }
    });
  }

  // ── Remove handler ──────────────────────────────────────────────

  function openRemoveDialog(member: TeamMember) {
    setRemoveDialog(member);
    setRemoveDialogError(null);
  }

  function handleConfirmRemove() {
    if (!removeDialog) return;
    setRemoveDialogError(null);

    startRemoveTransition(async () => {
      const result = await removeTeamMember(removeDialog.userId!);
      if (result.error) {
        setRemoveDialogError(result.error);
      } else {
        setRemoveDialog(null);
        await refreshMembers();
      }
    });
  }

  // ── Cancel invite handler ────────────────────────────────────────

  async function handleCancelInvite(member: TeamMember) {
    setPendingAction({ id: member.id, action: "cancel" });
    try {
      await cancelInvite(member.id);
      await refreshMembers();
    } catch {
      // Non-critical — silently fail and refresh anyway
    } finally {
      setPendingAction(null);
    }
  }

  // ── Resend invite handler ────────────────────────────────────────

  async function handleResendInvite(member: TeamMember) {
    setPendingAction({ id: member.id, action: "resend" });
    try {
      const result = await resendInvite(member.id);
      if (result.error) {
        setResendMessages((prev) => ({ ...prev, [member.id]: result.error! }));
      } else {
        setResendMessages((prev) => ({ ...prev, [member.id]: "Invite resent." }));
        await refreshMembers();
        setTimeout(() => {
          setResendMessages((prev) => {
            const next = { ...prev };
            delete next[member.id];
            return next;
          });
        }, 3000);
      }
    } finally {
      setPendingAction(null);
    }
  }

  // ── Reassign handler ──────────────────────────────────────────────

  function handleReassign(fromUserId: string, toUserId: string) {
    setReassignError(null);
    setReassignSuccess(null);
    setReassignPending(fromUserId);

    startReassignTransition(async () => {
      const result = await reassignClients(fromUserId, toUserId);
      setReassignPending(null);

      if (result.error) {
        setReassignError(result.error);
      } else {
        setReassignSuccess(
          `${result.reassigned ?? 0} client${result.reassigned === 1 ? "" : "s"} reassigned.`
        );
        router.refresh();
        setTimeout(() => setReassignSuccess(null), 4000);
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center size-12 rounded-lg bg-blue-500/10 shrink-0">
            <Users className="size-6 text-blue-500" />
          </div>
          <div className="flex-1 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Team</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your team members and client distribution
              </p>
            </div>

            {/* Summary */}
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{members.filter((m) => m.status === "active").length}</span>{" "}
                {members.filter((m) => m.status === "active").length === 1 ? "member" : "members"}
              </span>
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{totalClients}</span>{" "}
                {totalClients === 1 ? "client" : "clients"}
                {clientLimit !== null ? ` / ${clientLimit}` : " (unlimited)"}
              </span>
            </div>

            {/* Invite form */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Invite a team member</h3>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteMessage(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                  disabled={isInviting}
                  className="max-w-xs"
                />
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "admin" | "member")}
                  disabled={isInviting}
                >
                  <SelectTrigger className="h-9 w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <ButtonBase
                  variant="blue"
                  buttonType="icon-text"
                  onClick={handleInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                >
                  {isInviting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Invite
                    </>
                  )}
                </ButtonBase>
              </div>
              {inviteMessage && (
                <p
                  className={`text-sm font-medium ${
                    inviteMessage.type === "success"
                      ? "text-green-600"
                      : "text-status-danger"
                  }`}
                >
                  {inviteMessage.text}
                </p>
              )}
            </div>

            {/* Reassign feedback */}
            {reassignError && (
              <p className="text-sm font-medium text-destructive">{reassignError}</p>
            )}
            {reassignSuccess && (
              <p className="text-sm font-medium text-green-600">{reassignSuccess}</p>
            )}

            {/* Member list */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Members</h3>

              {loading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span className="text-sm">Loading team members...</span>
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No team members yet.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border">
                  {members.map((member) => {
                    const stats = member.userId ? accountantMap.get(member.userId) : undefined;
                    const clientCount = stats?.clientCount ?? 0;
                    const displayName = stats?.name && stats.name !== member.email ? stats.name : null;
                    const otherAccountants = accountants.filter(
                      (a) => a.userId !== member.userId
                    );
                    const isRowReassigning = isReassigning && reassignPending === member.userId;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        {/* Left: name/email + badges + client count */}
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <div className="min-w-0">
                            {displayName ? (
                              <>
                                <span className="text-sm font-medium truncate block">
                                  {displayName}
                                </span>
                                <span className="text-xs text-muted-foreground truncate block">
                                  {member.email}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-medium truncate block">
                                {member.email}
                              </span>
                            )}
                          </div>
                          <RoleBadge role={member.role} />
                          <StatusBadge status={member.status} />
                          {member.status === "active" && (
                            <span className="text-sm font-medium text-muted-foreground">
                              {clientCount} {clientCount === 1 ? "client" : "clients"}
                            </span>
                          )}
                        </div>

                        {/* Right: actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {member.status === "active" && member.userId && (
                            <>
                              <ButtonBase
                                variant="blue"
                                buttonType="icon-text"
                                onClick={() => openRoleDialog(member)}
                                disabled={
                                  isChangingRole &&
                                  roleDialog?.member.id === member.id
                                }
                              >
                                <ArrowLeftRight className="size-4" />
                                Change role
                              </ButtonBase>
                              <ButtonBase
                                variant="destructive"
                                buttonType="icon-text"
                                onClick={() => openRemoveDialog(member)}
                                disabled={
                                  isRemoving &&
                                  removeDialog?.id === member.id
                                }
                              >
                                <Trash2 className="size-4" />
                                Remove
                              </ButtonBase>
                              {showReassign && clientCount > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <ButtonBase
                                      variant="sky"
                                      buttonType="icon-text"
                                      disabled={isRowReassigning || isReassigning}
                                    >
                                      {isRowReassigning ? (
                                        <Loader2 className="size-4 animate-spin" />
                                      ) : (
                                        <>
                                          <ArrowLeftRight className="size-4" />
                                          Reassign
                                        </>
                                      )}
                                    </ButtonBase>
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
                                          handleReassign(member.userId!, target.userId)
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
                              )}
                            </>
                          )}

                          {member.status === "pending" && (
                            <>
                              <ButtonBase
                                variant="blue"
                                buttonType="icon-text"
                                onClick={() => handleResendInvite(member)}
                                disabled={
                                  pendingAction?.id === member.id
                                }
                              >
                                {pendingAction?.id === member.id &&
                                pendingAction.action === "resend" ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <>
                                    <RotateCcw className="size-4" />
                                    Resend
                                  </>
                                )}
                              </ButtonBase>
                              <ButtonBase
                                variant="amber"
                                buttonType="icon-text"
                                onClick={() => handleCancelInvite(member)}
                                disabled={
                                  pendingAction?.id === member.id
                                }
                              >
                                {pendingAction?.id === member.id &&
                                pendingAction.action === "cancel" ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  <>
                                    <Ban className="size-4" />
                                    Cancel
                                  </>
                                )}
                              </ButtonBase>
                              {resendMessages[member.id] && (
                                <span className="text-xs font-medium text-green-600">
                                  {resendMessages[member.id]}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Role change dialog */}
      <Dialog
        open={!!roleDialog}
        onOpenChange={(open) => {
          if (!open && !isChangingRole) setRoleDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Change role for{" "}
              <strong>{roleDialog?.member.email}</strong> to{" "}
              <strong>
                {roleDialog?.newRole === "admin" ? "Admin" : "Member"}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>

          {/* Role selector inside dialog */}
          {roleDialog && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New role</label>
              <Select
                value={roleDialog.newRole}
                onValueChange={(v) =>
                  setRoleDialog((prev) =>
                    prev ? { ...prev, newRole: v as "admin" | "member" } : null
                  )
                }
                disabled={isChangingRole}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {roleDialogError && (
            <p className="text-sm font-medium text-status-danger">
              {roleDialogError}
            </p>
          )}

          <DialogFooter showCloseButton>
            <ButtonBase
              variant="green"
              buttonType="icon-text"
              onClick={handleConfirmRoleChange}
              disabled={isChangingRole}
            >
              {isChangingRole ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Confirm
                </>
              )}
            </ButtonBase>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove member dialog */}
      <Dialog
        open={!!removeDialog}
        onOpenChange={(open) => {
          if (!open && !isRemoving) setRemoveDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member</DialogTitle>
            <DialogDescription>
              Remove <strong>{removeDialog?.email}</strong> from the team?
              This will immediately revoke their access.
            </DialogDescription>
          </DialogHeader>

          {removeDialogError && (
            <p className="text-sm font-medium text-status-danger">
              {removeDialogError}
            </p>
          )}

          <DialogFooter showCloseButton>
            <ButtonBase
              variant="destructive"
              buttonType="icon-text"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="size-4" />
                  Remove
                </>
              )}
            </ButtonBase>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
