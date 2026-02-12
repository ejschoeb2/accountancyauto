import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Auth check - onboarding requires authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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
