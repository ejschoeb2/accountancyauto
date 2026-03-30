"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, SlidersHorizontal, Play, FileText, BookOpen, ArrowRight } from "lucide-react";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

import {
  guides,
  guideCategories,
  guideTypes,
  guideTypeLabels,
  categoryColors,
} from "@/app/(marketing)/guides/data";
import type { Guide, GuideCategory, GuideType } from "@/app/(marketing)/guides/data";
import { guideIllustrations } from "@/components/marketing/guide-illustrations";
import { OnboardingTracker } from "./components/onboarding-tracker";

// ─── Tutorial card (video, autoplay in viewport) ────────────────────────────

const TutorialCard = ({ guide, index }: { guide: Guide; index: number }) => {
  const colors = categoryColors[guide.category];
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;

    const preloader = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.preload = "auto";
          preloader.disconnect();
        }
      },
      { rootMargin: "1500px" },
    );

    preloader.observe(card);
    return () => preloader.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className="group bg-card border border-border/60 rounded-2xl overflow-hidden shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 flex flex-col justify-center px-8 py-7">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}
            >
              {guide.category}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
              <Play size={10} className="fill-current" />
              Tutorial
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground leading-snug tracking-tight mb-3">
            {guide.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {guide.description}
          </p>
        </div>

        <div className="md:w-[65%] shrink-0 p-5">
          <div className="aspect-video bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
            <video
              ref={videoRef}
              src={guide.videoPath}
              controls
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Article card (text + screenshot placeholder) ───────────────────────────

const ArticleCard = ({ guide, index }: { guide: Guide; index: number }) => {
  const colors = categoryColors[guide.category];
  const hasLink = !!guide.href;
  const hasVideo = !!guide.videoPath;
  const Illustration = guideIllustrations[guide.id];
  const [isHovered, setIsHovered] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !Illustration) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.4 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [Illustration]);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    const preloader = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { video.preload = "auto"; preloader.disconnect(); }
      },
      { rootMargin: "1500px" },
    );
    preloader.observe(card);
    return () => preloader.disconnect();
  }, []);

  const isActive = isHovered || isInView;

  const content = (
    <div
      ref={cardRef}
      className="group bg-card border border-border/60 rounded-2xl overflow-hidden shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col md:flex-row">
        <div className="flex-1 flex flex-col justify-center px-8 py-7">
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}
            >
              {guide.category}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
              <FileText size={10} />
              Article
            </span>
          </div>
          <h2 className="text-lg font-bold text-foreground leading-snug tracking-tight mb-3">
            {guide.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {guide.description}
          </p>
          {hasLink && (
            <span className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-violet-600 group-hover:gap-2.5 transition-all duration-200">
              Explore the guide
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          )}
        </div>

        {/* Right side — video, illustration, screenshot, or placeholder */}
        {hasVideo ? (
          <div className="md:w-[65%] shrink-0 p-5">
            <div className="aspect-video bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
              <video
                ref={videoRef}
                src={guide.videoPath}
                controls
                muted
                loop
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        ) : Illustration ? (
          <div className="md:w-[55%] shrink-0 p-5">
            <div className="aspect-[16/10] bg-muted/30 rounded-xl overflow-hidden border border-border/40">
              <Illustration isHovered={isActive} />
            </div>
          </div>
        ) : guide.imagePath ? (
          <div className="md:w-[65%] shrink-0 p-5">
            <div className="aspect-[16/10] bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
              <img
                src={guide.imagePath}
                alt={guide.title}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="hidden md:flex md:w-[45%] shrink-0 items-center justify-center p-5">
            <div className="aspect-[16/10] w-full bg-muted/50 rounded-xl border border-border/40 border-dashed flex items-center justify-center">
              <FileText size={40} className="text-muted-foreground/30" />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (hasLink) {
    return <Link href={guide.href!} className="block">{content}</Link>;
  }

  return content;
};

// ─── Long-form guide card (text-forward, links to full page) ────────────────

const LongformGuideCard = ({ guide, index }: { guide: Guide; index: number }) => {
  const colors = categoryColors[guide.category];
  const hasVideo = !!guide.videoPath;
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    const preloader = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { video.preload = "auto"; preloader.disconnect(); }
      },
      { rootMargin: "1500px" },
    );
    preloader.observe(card);
    return () => preloader.disconnect();
  }, []);

  return (
    <Link href={guide.href!} className="block">
      <div
        ref={cardRef}
        className="group bg-card border border-border/60 rounded-2xl overflow-hidden shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
      >
        <div className={hasVideo ? "flex flex-col md:flex-row" : ""}>
          <div className={`flex flex-col justify-center px-8 py-7 ${hasVideo ? "flex-1" : ""}`}>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-block text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full ${colors.bg} ${colors.text}`}
              >
                {guide.category}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700">
                <BookOpen size={10} />
                Guide
              </span>
            </div>
            <h2 className="text-lg font-bold text-foreground leading-snug tracking-tight mb-3">
              {guide.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {guide.description}
            </p>
            <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold text-violet-600 group-hover:gap-2.5 transition-all duration-200">
              Read guide
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </div>

          {hasVideo && (
            <div className="md:w-[65%] shrink-0 p-5">
              <div className="aspect-video bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
                <video
                  ref={videoRef}
                  src={guide.videoPath}
                  controls
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

// ─── Guide card dispatcher ──────────────────────────────────────────────────

const GuideCard = ({ guide, index }: { guide: Guide; index: number }) => {
  if (guide.type === "tutorial") {
    return <TutorialCard guide={guide} index={index} />;
  }
  if (guide.type === "guide") {
    return <LongformGuideCard guide={guide} index={index} />;
  }
  return <ArticleCard guide={guide} index={index} />;
};

// ─── Page ────────────────────────────────────────────────────────────────────

function GuidesContent() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<GuideCategory | null>(null);
  const [activeType, setActiveType] = useState<GuideType | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredGuides = useMemo(() => {
    return guides.filter((g) => {
      if (activeCategory && g.category !== activeCategory) return false;
      if (activeType && g.type !== activeType) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack =
          `${g.title} ${g.description} ${g.searchTags.join(" ")}`.toLowerCase();
        return haystack.includes(q);
      }
      return true;
    });
  }, [query, activeCategory, activeType]);

  const activeFilterCount =
    (activeCategory ? 1 : 0) + (activeType ? 1 : 0);

  return (
    <main className="min-h-screen">
      <MarketingNav />

      <section className="pt-10 lg:pt-14 pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          {/* Centered header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] mb-4">
              Guides
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Tutorials, articles, and reference guides for every feature in
              Prompt. Search or filter to find what you need.
            </p>
          </div>

          {/* Centered search bar + filter button */}
          <div className="max-w-2xl mx-auto mb-12">
            {/* Search row */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search guides..."
                  className="w-full rounded-2xl border border-border/60 bg-card pl-12 pr-12 py-4 text-base text-foreground placeholder:text-muted-foreground shadow-md shadow-black/5 hover:shadow-lg hover:border-border focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/30 transition-all duration-200"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Filter toggle button */}
              <button
                onClick={() => setFiltersOpen((o) => !o)}
                className={`shrink-0 flex items-center gap-2 rounded-2xl border px-5 py-4 text-sm font-semibold shadow-md shadow-black/5 hover:shadow-lg transition-all duration-200 ${
                  filtersOpen || activeFilterCount > 0
                    ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                    : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                }`}
              >
                <SlidersHorizontal size={18} />
                <span className="hidden sm:inline">Filter</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Inline filter panel — expands below the search row */}
            <AnimatePresence initial={false}>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card border border-border/60 rounded-2xl shadow-sm shadow-black/5 p-5 mt-3">
                    <div className="flex flex-col sm:flex-row sm:gap-8 gap-5">
                      {/* Type filter */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-foreground">Type</span>
                          {activeType && (
                            <button
                              onClick={() => setActiveType(null)}
                              className="text-xs text-violet-600 hover:text-violet-700 font-semibold transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {guideTypes.map((t) => {
                            const isActive = activeType === t;
                            return (
                              <button
                                key={t}
                                onClick={() => setActiveType(isActive ? null : t)}
                                className={`text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full border transition-all duration-200 ${
                                  isActive
                                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                    : "bg-background text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                                }`}
                              >
                                {guideTypeLabels[t]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="hidden sm:block w-px bg-border/50" />

                      {/* Category filter */}
                      <div className="flex-[2]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-foreground">Category</span>
                          {activeCategory && (
                            <button
                              onClick={() => setActiveCategory(null)}
                              className="text-xs text-violet-600 hover:text-violet-700 font-semibold transition-colors"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {guideCategories.map((cat) => {
                            const isActive = activeCategory === cat;
                            return (
                              <button
                                key={cat}
                                onClick={() => setActiveCategory(isActive ? null : cat)}
                                className={`text-[12px] font-semibold tracking-wide px-3.5 py-1.5 rounded-full border transition-all duration-200 ${
                                  isActive
                                    ? "bg-violet-600 text-white border-violet-600 shadow-sm"
                                    : "bg-background text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                                }`}
                              >
                                {cat}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result count */}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing {filteredGuides.length} of {guides.length} guides
            </p>
          </div>

          {/* Guide cards — single column */}
          <div className="grid grid-cols-1 gap-8">
            {filteredGuides.map((guide, i) => (
              <GuideCard key={guide.id} guide={guide} index={i} />
            ))}
          </div>

          {/* Empty state */}
          <AnimatePresence>
            {filteredGuides.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <p className="text-lg text-muted-foreground mb-4">
                  No guides match your search.
                </p>
                <button
                  onClick={() => {
                    setQuery("");
                    setActiveCategory(null);
                    setActiveType(null);
                  }}
                  className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <FooterSection />
    </main>
  );
}

export default function GuidesPage() {
  return (
    <Suspense>
      <OnboardingTracker step="guides" />
      <GuidesContent />
    </Suspense>
  );
}
