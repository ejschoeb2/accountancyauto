import { redirect } from "next/navigation";
import Image from "next/image";
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

  if (!user) {
    redirect("/login");
  }

  // Gate: if member already completed wizard, redirect to their dashboard
  try {
    const setupComplete = await getMemberSetupComplete();

    if (setupComplete) {
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
            redirect(`/?org=${org.slug}`);
          } else {
            redirect(`https://${org.slug}.app.phasetwo.uk/`);
          }
        }
      }

      // Fallback if slug resolution fails — just redirect to root
      redirect("/");
    }
  } catch {
    // getMemberSetupComplete may throw if no org context yet (new member
    // who accepted invite but has not yet completed setup). Silently let
    // the wizard proceed.
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl space-y-8">
        {/* Branding — same as onboarding */}
        <div className="flex items-center justify-center gap-4">
          <Image
            src="/logofini.png"
            alt="Logo"
            width={48}
            height={48}
            className="object-contain"
          />
          <div className="w-px h-12 bg-border" />
          <Image
            src="/peninsulaccountinglogo.jpg"
            alt="Peninsula Accounting"
            width={140}
            height={48}
            className="object-contain"
          />
        </div>

        {children}
      </div>
    </div>
  );
}
