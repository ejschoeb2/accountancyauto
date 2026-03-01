import { Metadata } from "next";
import { MarketingNav } from "@/components/marketing/nav";
import { HelpContent } from "@/components/marketing/help-content";

export const metadata: Metadata = {
  title: "Help Centre — Prompt",
  description:
    "Learn how to use Prompt to manage clients, track deadlines, and automate reminders for your accounting practice.",
};

export default function HelpPage() {
  return (
    <>
      <MarketingNav />
      <HelpContent />
    </>
  );
}
