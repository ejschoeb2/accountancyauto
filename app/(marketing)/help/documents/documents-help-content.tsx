"use client";

import { useState, useEffect } from "react";
import { MarketingNav } from "@/components/marketing/nav";
import { FileText } from "lucide-react";

interface DocumentInfo {
  code: string;
  label: string;
  description: string;
}

interface Section {
  id: string;
  label: string;
  documents: DocumentInfo[];
}

interface DocumentsHelpContentProps {
  sections: Section[];
}

export function DocumentsHelpContent({ sections }: DocumentsHelpContentProps) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && sections.some((s) => s.id === hash)) {
      setActive(hash);
    }
  }, [sections]);

  function handleSelect(id: string) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  }

  const activeSection = sections.find((s) => s.id === active);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingNav hideLogin hideSignup />

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full px-4 md:px-6 gap-10 py-10">
        {/* Sidebar — desktop */}
        <aside className="hidden md:block w-56 shrink-0">
          <nav className="sticky top-6">
            <p className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3 px-3">
              Filing types
            </p>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => handleSelect(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-[13.5px] font-medium transition-colors ${
                      active === s.id
                        ? "bg-violet-600/10 text-violet-700 dark:text-violet-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 px-3">
              <a
                href="/help"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back to Help
              </a>
            </div>
          </nav>
        </aside>

        {/* Mobile nav strip */}
        <div className="md:hidden w-full mb-6">
          <div className="overflow-x-auto">
            <div className="flex gap-1 min-w-max pb-2">
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSelect(s.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                    active === s.id
                      ? "bg-violet-600 text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 pb-24">
          <div className="pb-4 border-b border-border/60 mb-8">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Document guide</h1>
            <p className="text-[14.5px] text-muted-foreground leading-relaxed mt-2">
              Your accountant uses Prompt to collect documents for UK tax and company filings.
              This guide explains each document they may request — what it is, where to find it,
              and why it&apos;s needed. If you&apos;re unsure about anything, contact your accountant directly.
            </p>
          </div>

          {activeSection && (
            <div>
              <div className="pb-4 border-b border-border/60 mb-6">
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  {activeSection.label}
                </h2>
              </div>

              <div className="space-y-4">
                {activeSection.documents.map((doc) => (
                  <div
                    key={doc.code}
                    className="rounded-xl border bg-card p-5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center size-9 rounded-lg bg-violet-500/10 shrink-0 mt-0.5">
                        <FileText className="size-4 text-violet-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">{doc.label}</h3>
                        {doc.description && (
                          <p className="text-[14px] text-muted-foreground leading-relaxed mt-1.5">
                            {doc.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
