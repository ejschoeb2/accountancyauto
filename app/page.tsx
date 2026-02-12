import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // Check authentication (middleware handles redirect, but belt-and-suspenders)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // All authenticated users go straight to dashboard
  // Configuration (clients, email settings) available via Settings page
  redirect("/dashboard");
}
