import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOnboardingComplete } from "@/app/actions/settings";

export default async function Home() {
  const supabase = await createClient();

  // Check authentication (middleware handles redirect, but belt-and-suspenders)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if this is a demo deployment
  const isDemo = process.env.NEXT_PUBLIC_IS_DEMO === "true";

  // Demo deployments skip onboarding entirely
  if (isDemo) {
    redirect("/dashboard");
  }

  // For real deployments, check if onboarding is complete
  const onboardingComplete = await getOnboardingComplete();

  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
