"use client";

import { useRouter } from "next/navigation";
import { ButtonBase } from "@/components/ui/button-base";
import { createClient } from "@/lib/supabase/client";

interface SignOutButtonProps {
  isDemoMode?: boolean;
}

export function SignOutButton({ isDemoMode = false }: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <ButtonBase
      buttonType="text-only"
      variant={isDemoMode ? "violet" : "neutral"}
      onClick={handleSignOut}
    >
      {isDemoMode ? "Leave Demo Mode" : "Sign Out"}
    </ButtonBase>
  );
}
