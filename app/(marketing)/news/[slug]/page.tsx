import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";
import { articles } from "@/app/(marketing)/news/data";
import type { Article } from "@/app/(marketing)/news/data";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) {
    return { title: "Article Not Found — Prompt" };
  }
  return {
    title: `${article.headline} — Prompt`,
    description: article.excerpt,
  };
}

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

// ─── Category pill colours ────────────────────────────────────────────────────

const categoryStyles: Record<Article["category"], string> = {
  Product:  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Guide:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Industry: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <MarketingNav />

      <article className="py-20 lg:py-28">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="max-w-2xl mx-auto">

            {/* Back link */}
            <a
              href="/news"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 group"
            >
              <ArrowLeft
                size={14}
                className="transition-transform duration-200 group-hover:-translate-x-0.5"
              />
              Back to News &amp; Insights
            </a>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span
                className={`inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${categoryStyles[article.category]}`}
              >
                {article.category}
              </span>
              <span className="text-sm text-muted-foreground">{article.date}</span>
              <span className="text-muted-foreground/40 text-sm">·</span>
              <span className="text-sm text-muted-foreground">{article.author}</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground leading-[1.2] tracking-tight mb-6">
              {article.headline}
            </h1>

            {/* Excerpt / standfirst */}
            <p className="text-base text-muted-foreground leading-relaxed border-l-2 border-violet-500 pl-4 mb-10">
              {article.excerpt}
            </p>

            {/* Body */}
            <div className="space-y-5">
              {article.body.map((paragraph, i) => (
                <p
                  key={i}
                  className="text-[15px] text-foreground/80 leading-[1.75]"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Divider */}
            <hr className="my-14 border-border/60" />

            {/* Bottom CTA */}
            <div className="rounded-2xl bg-card border border-border/60 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-[15px] font-bold text-foreground mb-1">
                  Ready to stop chasing clients for records?
                </p>
                <p className="text-sm text-muted-foreground">
                  Prompt automates your reminder pipeline — deadlines tracked,
                  emails sent, documents collected. All without manual effort.
                </p>
              </div>
              <a
                href="/onboarding"
                className="shrink-0 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-violet-500/30 hover:bg-violet-700 hover:shadow-violet-500/50 active:scale-95 transition-all duration-200"
              >
                Try Prompt free
                <ArrowRight size={14} />
              </a>
            </div>

          </div>
        </div>
      </article>

      <FooterSection />
    </main>
  );
}
