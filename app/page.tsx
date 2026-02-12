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

  // Check setup mode
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "setup_mode")
    .single();

  if (!data) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
