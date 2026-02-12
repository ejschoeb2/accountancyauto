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

  // Demo users skip onboarding entirely
  if (user.email === "demo@peninsula-internal.local") {
    redirect("/dashboard");
  }

  // For non-demo users, check if onboarding is complete
  const onboardingComplete = await getOnboardingComplete();

  if (!onboardingComplete) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
