import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check auth state — but do NOT block unauthenticated users (Step 1 is for them)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // ONBD-06: Already-onboarded users cannot re-enter /onboarding
    // Check if user already belongs to an org
    const admin = createAdminClient();
    const { data: userOrg } = await admin
      .from("user_organisations")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (userOrg?.org_id) {
      // User has an org — resolve slug and redirect to their dashboard
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
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prompt.qpon";
          const baseDomain = appUrl.replace(/^https?:\/\/(www\.)?/, "");
          redirect(`https://${org.slug}.app.${baseDomain}/dashboard`);
        }
      }
    }
    // User is authenticated but has no org — let them proceed with the wizard (Steps 2-4)
  }
  // Unauthenticated user — let them proceed with Step 1 (magic link)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl space-y-8">
        {/* Branding */}
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
