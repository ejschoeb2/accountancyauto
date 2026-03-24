import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tutorials — Prompt",
  description:
    "Short video walkthroughs for every feature in Prompt. Learn how to manage clients, deadlines, emails, documents, and more.",
};

export default function TutorialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
