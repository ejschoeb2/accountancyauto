"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

import { articles } from "@/app/(marketing)/news/data";
import type { Article } from "@/app/(marketing)/news/data";

export { articles };
export type { Article };

// ─── Category pill colours ────────────────────────────────────────────────────

const categoryStyles: Record<Article["category"], string> = {
  Product:  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Guide:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Industry: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

// ─── Article card ─────────────────────────────────────────────────────────────

const ArticleCard = ({
  article,
  index,
}: {
  article: Article;
  index: number;
}) => (
  <motion.article
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{
      type: "spring",
      stiffness: 90,
      damping: 18,
      delay: (index % 3) * 0.08,
    }}
    className="group bg-card border border-border/60 rounded-2xl p-6 flex flex-col hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-default"
  >
    {/* Category + date row */}
    <div className="flex items-center justify-between gap-3 mb-4">
      <span
        className={`inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${categoryStyles[article.category]}`}
      >
        {article.category}
      </span>
      <span className="text-xs text-muted-foreground shrink-0">{article.date}</span>
    </div>

    {/* Headline */}
    <h2 className="text-[16px] font-bold text-foreground leading-snug tracking-tight mb-3 flex-1">
      {article.headline}
    </h2>

    {/* Excerpt */}
    <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-3">
      {article.excerpt}
    </p>

    {/* Footer: author + read more */}
    <div className="flex items-center justify-between gap-3 mt-auto pt-4 border-t border-border/60">
      <span className="text-xs text-muted-foreground">{article.author}</span>
      <a
        href={`/news/${article.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors group-hover:gap-1.5 duration-200"
      >
        Read more
        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
      </a>
    </div>
  </motion.article>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsPage() {
  return (
    <main className="min-h-screen">
      <MarketingNav />

      <section className="py-20 lg:py-28">
        <div className="max-w-screen-xl mx-auto px-4">

          {/* Section header */}
          <div className="max-w-2xl mb-16">
            <p className="text-[13px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
              Resources
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15] mb-4">
              News &amp; Insights
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Practical guides, product updates, and industry commentary for UK
              accounting practices.
            </p>
          </div>

          {/* Article grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article, i) => (
              <ArticleCard key={article.slug} article={article} index={i} />
            ))}
          </div>

        </div>
      </section>

      <FooterSection />
    </main>
  );
}
