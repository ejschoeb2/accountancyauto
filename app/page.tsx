import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
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
