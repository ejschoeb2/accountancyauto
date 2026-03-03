import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMemberSetupComplete } from "@/app/actions/settings";

export default async function SetupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auth check — unauthenticated users cannot enter the setup wizard
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users are allowed through — the wizard page shows the
  // Account step so they can create an account without hitting /login first.

  // Gate: if member already completed wizard, redirect to their dashboard
  try {
    const setupComplete = await getMemberSetupComplete();

    if (setupComplete && user) {
      // Resolve org slug for dashboard redirect
      const admin = createAdminClient();
      const { data: userOrg } = await admin
        .from("user_organisations")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (userOrg?.org_id) {
        const { data: org } = await admin
          .from("organisations")
          .select("slug")
          .eq("id", userOrg.org_id)
          .single();

        if (org?.slug) {
          const isDev = process.env.NODE_ENV === "development";
          if (isDev) {
            redirect(`/dashboard?org=${org.slug}`);
          } else {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.accountants";
            const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
            redirect(`https://${org.slug}.app.${baseDomain}/dashboard`);
          }
        }
      }

      // Fallback if slug resolution fails — just redirect to dashboard
      redirect("/dashboard");
    }
  } catch {
    // getMemberSetupComplete may throw if no org context yet (new member
    // who accepted invite but has not yet completed setup). Silently let
    // the wizard proceed.
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-16 p-8">
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}
