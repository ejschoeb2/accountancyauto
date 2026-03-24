import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides — Prompt",
  description:
    "Tutorials, articles, and reference guides for every feature in Prompt. Learn how to manage clients, deadlines, emails, documents, and more.",
};

export default function GuidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
