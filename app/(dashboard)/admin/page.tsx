import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrgTable } from "./components/org-table";

export const metadata = {
  title: "Admin — Platform Overview",
};

export default async function AdminPage() {
  // Super-admin guard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.app_metadata?.is_super_admin) {
    redirect("/dashboard");
  }

  // Data fetch using admin client (service role — bypasses RLS)
  const admin = createAdminClient();

  const { data: orgs, error: orgsError } = await admin
    .from("organisations")
    .select(
      "id, name, slug, plan_tier, subscription_status, trial_ends_at, stripe_subscription_id, client_count_limit, created_at"
    )
    .order("created_at", { ascending: true });

  if (orgsError) {
    throw new Error(`Failed to fetch organisations: ${orgsError.message}`);
  }

  const orgList = orgs ?? [];

  // Fetch client and user counts per org in parallel
  const countsResults = await Promise.all(
    orgList.map(async (org) => {
      const [{ count: clientCount }, { count: userCount }] = await Promise.all([
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
      ]);
      return { orgId: org.id, clientCount, userCount };
    })
  );

  // Combine org data with counts
  const countsMap = Object.fromEntries(
    countsResults.map((r) => [r.orgId, { clientCount: r.clientCount, userCount: r.userCount }])
  );

  const orgsWithCounts = orgList.map((org) => ({
    ...org,
    clientCount: countsMap[org.id]?.clientCount ?? 0,
    userCount: countsMap[org.id]?.userCount ?? 0,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1>Admin</h1>
        <p className="text-muted-foreground">
          Platform overview — all organisations
        </p>
      </div>
      <OrgTable orgs={orgsWithCounts} />
    </div>
  );
}
