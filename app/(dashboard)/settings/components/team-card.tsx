"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import { Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  getTeamMembers,
  sendInvite,
  removeTeamMember,
  changeRole,
  cancelInvite,
  resendInvite,
  type TeamMember,
} from "@/app/actions/team";

// ── Role badge (inline div+span pattern from DESIGN.md) ─────────────

function RoleBadge({ role }: { role: "admin" | "member" }) {
  if (role === "admin") {
    return (
      <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-blue-500/10">
        <span className="text-xs font-medium text-blue-500">Admin</span>
      </div>
    );
  }
  return (
    <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-status-neutral/10">
      <span className="text-xs font-medium text-status-neutral">Member</span>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "active" | "pending" }) {
  if (status === "pending") {
    return (
      <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-amber-500/10">
        <span className="text-xs font-medium text-amber-600">Pending</span>
      </div>
    );
  }
  return (
    <div className="px-2 py-0.5 rounded-md inline-flex items-center bg-green-500/10">
      <span className="text-xs font-medium text-green-600">Active</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function TeamCard() {
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
                Manage your team members and pending invitations
              </p>
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
                <Button
                  onClick={handleInvite}
                  disabled={isInviting || !inviteEmail.trim()}
                  size="sm"
                >
                  {isInviting ? (
                    <>
                      <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    "Invite"
                  )}
                </Button>
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
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      {/* Left: email + badges */}
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {member.email}
                        </span>
                        <RoleBadge role={member.role} />
                        <StatusBadge status={member.status} />
                      </div>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {member.status === "active" && member.userId && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRoleDialog(member)}
                              disabled={
                                isChangingRole &&
                                roleDialog?.member.id === member.id
                              }
                            >
                              Change role
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openRemoveDialog(member)}
                              disabled={
                                isRemoving &&
                                removeDialog?.id === member.id
                              }
                            >
                              Remove
                            </Button>
                          </>
                        )}

                        {member.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvite(member)}
                              disabled={
                                pendingAction?.id === member.id
                              }
                            >
                              {pendingAction?.id === member.id &&
                              pendingAction.action === "resend" ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                "Resend"
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancelInvite(member)}
                              disabled={
                                pendingAction?.id === member.id
                              }
                            >
                              {pendingAction?.id === member.id &&
                              pendingAction.action === "cancel" ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                "Cancel"
                              )}
                            </Button>
                            {resendMessages[member.id] && (
                              <span className="text-xs font-medium text-green-600">
                                {resendMessages[member.id]}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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
            <Button
              onClick={handleConfirmRoleChange}
              disabled={isChangingRole}
            >
              {isChangingRole ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Confirm"
              )}
            </Button>
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
            <Button
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
            >
              {isRemoving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
