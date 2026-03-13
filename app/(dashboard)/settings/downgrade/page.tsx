import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/auth/org-context";
import { getClients } from "@/app/actions/clients";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanByTier, type PlanTier, PAID_PLAN_TIERS } from "@/lib/stripe/plans";
import { DowngradeClientTable } from "./components/downgrade-client-table";

const VALID_DOWNGRADE_TIERS: PlanTier[] = ["free", ...PAID_PLAN_TIERS];

interface DowngradePageProps {
  searchParams: Promise<{ plan?: string }>;
}

export default async function DowngradePage({ searchParams }: DowngradePageProps) {
  const params = await searchParams;
  const targetTier = params.plan as PlanTier | undefined;

  if (!targetTier || !VALID_DOWNGRADE_TIERS.includes(targetTier)) {
    redirect("/settings?tab=billing");
  }

  const { orgId, orgRole } = await getOrgContext();

  if (orgRole !== "admin") {
    redirect("/settings?tab=billing");
  }

  const targetPlan = getPlanByTier(targetTier);
  const targetLimit = targetPlan.clientLimit;

  if (targetLimit === null) {
    // Unlimited plan — no need to select clients
    redirect("/settings?tab=billing");
  }

  const [clients, orgResult] = await Promise.all([
    getClients(),
    createAdminClient()
      .from("organisations")
      .select("plan_tier")
      .eq("id", orgId)
      .single(),
  ]);

  const currentTier = (orgResult.data?.plan_tier ?? "free") as PlanTier;
  const currentPlan = getPlanByTier(currentTier);

  // If client count is within the target limit, no selection needed
  if (clients.length <= targetLimit) {
    redirect("/settings?tab=billing");
  }

  const clientsToRemove = clients.length - targetLimit;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <DowngradeClientTable
        clients={clients}
        clientsToRemove={clientsToRemove}
        targetTier={targetTier}
        targetPlanName={targetPlan.name}
        targetLimit={targetLimit}
        currentPlanName={currentPlan.name}
        orgId={orgId}
      />
    </div>
  );
}
