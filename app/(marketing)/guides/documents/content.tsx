"use client";

import { useState } from "react";
import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

export interface DocumentInfo {
  code: string;
  label: string;
  description: string;
}

export interface DocumentSection {
  id: string;
  label: string;
  documents: DocumentInfo[];
}

export function DocumentGuideContent({
  sections,
}: {
  sections: DocumentSection[];
}) {
  const [activeType, setActiveType] = useState(sections[0]?.id ?? "");
  const activeSection = sections.find((s) => s.id === activeType);

  return (
    <main className="min-h-screen">
      <MarketingNav />

      <section className="pt-10 lg:pt-14 pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          {/* Back link */}
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft size={15} />
            Back to Guides
          </Link>

          {/* Header */}
          <div className="max-w-2xl mb-10">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.1] mb-4">
              Document Guide
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A comprehensive reference for every document your practice may
              request from clients — what it is, where to find it, and why
              it&apos;s needed. Share{" "}
              <strong className="text-foreground">/guides/documents</strong>{" "}
              with clients who are unsure what to upload.
            </p>
          </div>

          {/* Filing type tabs */}
          <div className="overflow-x-auto mb-8">
            <div className="flex gap-1.5 min-w-max">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveType(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    activeType === s.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document cards */}
          {activeSection && (
            <div className="space-y-3">
              {activeSection.documents.map((doc) => (
                <div
                  key={doc.code}
                  className="rounded-xl border border-border/60 bg-card shadow-sm shadow-black/5 p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center size-9 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
                      <FileText className="size-4 text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {doc.label}
                      </p>
                      {doc.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <FooterSection />
    </main>
  );
}
