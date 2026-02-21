import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyableText } from "../components/copyable-text";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: `Admin — ${slug}` };
}

// Reuse the same STATUS_CONFIG pattern as org-table.tsx for visual consistency
const STATUS_CONFIG: Record<string, { label: string; bgClass: string; textClass: string }> = {
  active:    { label: "Active",           bgClass: "bg-green-500/10",      textClass: "text-green-600" },
  trialing:  { label: "Trial",            bgClass: "bg-blue-500/10",       textClass: "text-blue-500" },
  past_due:  { label: "Payment overdue",  bgClass: "bg-amber-500/10",      textClass: "text-amber-600" },
  cancelled: { label: "Cancelled",        bgClass: "bg-destructive/10",    textClass: "text-destructive" },
  unpaid:    { label: "Unpaid",           bgClass: "bg-destructive/10",    textClass: "text-destructive" },
};

const DEFAULT_STATUS_CONFIG = {
  label: "No subscription",
  bgClass: "bg-status-neutral/10",
  textClass: "text-status-neutral",
};

function formatPlanTier(tier: string | null): string {
  if (!tier) return "—";
  return tier
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTrialExpiry(trialEndsAt: string | null): string | null {
  if (!trialEndsAt) return null;
  const now = new Date();
  const end = new Date(trialEndsAt);
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `${diffDays} day${diffDays === 1 ? "" : "s"} left`;
  if (diffDays === 0) return "Expires today";
  const ago = Math.abs(diffDays);
  return `Expired ${ago} day${ago === 1 ? "" : "s"} ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default async function OrgDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Super-admin guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.app_metadata?.is_super_admin) {
    redirect("/dashboard");
  }

  // Fetch the org by slug using admin client (service role — bypasses RLS)
  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organisations")
    .select(
      "id, name, slug, plan_tier, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, client_count_limit, user_count_limit, postmark_server_token, postmark_sender_domain, created_at"
    )
    .eq("slug", slug)
    .single();

  if (orgError || !org) {
    // Not found state
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all organisations
        </Link>
        <div className="py-16 text-center space-y-2">
          <h2 className="text-lg font-semibold">Organisation not found</h2>
          <p className="text-sm text-muted-foreground">
            No organisation with slug <code className="font-mono">{slug}</code> exists.
          </p>
        </div>
      </div>
    );
  }

  // Fetch client and user counts for this org
  const [[{ count: clientCount }, { count: userCount }], { data: memberships }] =
    await Promise.all([
      Promise.all([
        admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .then((r) => ({ count: r.count ?? 0 })),
        admin
          .from("user_organisations")
          .select("user_id", { count: "exact", head: true })
          .eq("org_id", org.id)
          .then((r) => ({ count: r.count ?? 0 })),
      ]),
      admin
        .from("user_organisations")
        .select("user_id, role, created_at")
        .eq("org_id", org.id),
    ]);

  // Resolve member emails and names via Supabase Admin Auth API
  const members = await Promise.all(
    (memberships ?? []).map(async (m) => {
      const {
        data: { user: authUser },
      } = await admin.auth.admin.getUserById(m.user_id);
      return {
        email: authUser?.email ?? "—",
        name: authUser?.user_metadata?.full_name ?? authUser?.email ?? "—",
        role: m.role as string,
      };
    })
  );

  const statusConfig =
    org.subscription_status && STATUS_CONFIG[org.subscription_status]
      ? STATUS_CONFIG[org.subscription_status]
      : DEFAULT_STATUS_CONFIG;

  const trialExpiry = formatTrialExpiry(org.trial_ends_at);
  const isTrialExpired = trialExpiry?.startsWith("Expired");

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page header with back link */}
      <div className="space-y-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all organisations
        </Link>
        <h1 className="pt-2">{org.name}</h1>
        <p className="text-muted-foreground font-mono text-sm">{org.slug}</p>
      </div>

      {/* Section 1: Organisation Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Organisation Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Name
              </dt>
              <dd className="text-sm">{org.name}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Slug
              </dt>
              <dd>
                <code className="text-sm font-mono text-muted-foreground">{org.slug}</code>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Plan
              </dt>
              <dd className="text-sm">{formatPlanTier(org.plan_tier)}</dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </dt>
              <dd>
                <div className={`px-3 py-1 rounded-md inline-flex items-center ${statusConfig.bgClass}`}>
                  <span className={`text-sm font-medium ${statusConfig.textClass}`}>
                    {statusConfig.label}
                  </span>
                </div>
              </dd>
            </div>

            {org.subscription_status === "trialing" && trialExpiry && (
              <div>
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Trial Expiry
                </dt>
                <dd className={`text-sm ${isTrialExpired ? "text-destructive" : ""}`}>
                  {trialExpiry}
                </dd>
              </div>
            )}

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Client Limit
              </dt>
              <dd className="text-sm">
                {clientCount} / {org.client_count_limit != null ? org.client_count_limit : "Unlimited"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                User Limit
              </dt>
              <dd className="text-sm">
                {userCount} / {org.user_count_limit != null ? org.user_count_limit : "Unlimited"}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Postmark Token
              </dt>
              <dd>
                {org.postmark_server_token ? (
                  <div className="px-3 py-1 rounded-md inline-flex items-center bg-green-500/10">
                    <span className="text-sm font-medium text-green-600">Configured</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-md inline-flex items-center bg-status-neutral/10">
                    <span className="text-sm font-medium text-status-neutral">Not configured</span>
                  </div>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Postmark Sender Domain
              </dt>
              <dd className="text-sm">
                {org.postmark_sender_domain ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Created
              </dt>
              <dd className="text-sm">{formatDate(org.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Section 2: Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {members.length > 0 ? (
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="py-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Name
                      </span>
                    </TableHead>
                    <TableHead className="py-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Email
                      </span>
                    </TableHead>
                    <TableHead className="py-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Role
                      </span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member, i) => (
                    <TableRow key={i}>
                      <TableCell className="py-3 font-medium">{member.name}</TableCell>
                      <TableCell className="py-3 text-muted-foreground">{member.email}</TableCell>
                      <TableCell className="py-3">{capitalise(member.role)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="px-6 pb-6">
              <p className="text-sm text-muted-foreground">No team members found.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Stripe Information */}
      <Card>
        <CardHeader>
          <CardTitle>Stripe</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Customer ID
              </dt>
              <dd>
                {org.stripe_customer_id ? (
                  <CopyableText value={org.stripe_customer_id} />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Subscription ID
              </dt>
              <dd>
                {org.stripe_subscription_id ? (
                  <CopyableText value={org.stripe_subscription_id} />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
