import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompt — Automated Client Reminders for UK Accountants",
  description:
    "Stop chasing clients for records. Prompt automates reminders for Corporation Tax, VAT, Self Assessment, and Companies House deadlines.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
