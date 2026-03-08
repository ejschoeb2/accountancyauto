import { redirect } from "next/navigation";

export default function PricingPage() {
  redirect("/settings?tab=billing");
}
