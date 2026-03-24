"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { FooterSection } from "@/components/marketing/footer-section";

import {
  tutorials,
  tutorialCategories,
  categoryColors,
} from "@/app/(marketing)/tutorials/data";
import type { Tutorial, TutorialCategory } from "@/app/(marketing)/tutorials/data";

// ─── Tutorial card (full-width, autoplay in viewport) ───────────────────────

const TutorialCard = ({
  tutorial,
  index,
}: {
  tutorial: Tutorial;
  index: number;
}) => {
  const colors = categoryColors[tutorial.category];
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Autoplay when card enters the main viewport, pause when it leaves
  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Skip the login sequence at the start of each recording
          if (video.currentTime < 9) video.currentTime = 9;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      // Card is considered "in main view" when 40% visible
      { threshold: 0.4 },
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // Preload videos 2 cards ahead via a generous rootMargin
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
      // Start loading when card is within 1500px of the viewport
      { rootMargin: "1500px" },
    );

    preloader.observe(card);
    return () => preloader.disconnect();
  }, []);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        type: "spring",
        stiffness: 90,
        damping: 18,
      }}
      className="group bg-card border border-border/60 rounded-2xl overflow-hidden shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
    >
      <div className="flex flex-col md:flex-row">
        {/* Content — left side, vertically centered */}
        <div className="flex-1 flex flex-col justify-center px-8 py-7">
          <span
            className={`inline-block self-start text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full mb-3 ${colors.bg} ${colors.text}`}
          >
            {tutorial.category}
          </span>
          <h2 className="text-lg font-bold text-foreground leading-snug tracking-tight mb-3">
            {tutorial.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tutorial.description}
          </p>
        </div>

        {/* Video — right side, padded */}
        <div className="md:w-[65%] shrink-0 p-5">
          <div className="aspect-[16/10] bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
            <video
              ref={videoRef}
              src={tutorial.videoPath}
              controls
              muted
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TutorialsPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<TutorialCategory | null>(
    null,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close filters on outside click
  useEffect(() => {
    if (!filtersOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersOpen]);

  const filteredTutorials = useMemo(() => {
    return tutorials.filter((t) => {
      if (activeCategory && t.category !== activeCategory) return false;
      if (query) {
        const q = query.toLowerCase();
        const haystack =
          `${t.title} ${t.description} ${t.searchTags.join(" ")}`.toLowerCase();
        return haystack.includes(q);
      }
      return true;
    });
  }, [query, activeCategory]);

  const hasActiveFilter = activeCategory !== null;

  return (
    <main className="min-h-screen">
      <MarketingNav />

      <section className="pt-10 lg:pt-14 pb-20 lg:pb-28">
        <div className="max-w-screen-xl mx-auto px-4">
          {/* Centered header */}
          <div className="text-center mb-8">
            <h1 className="text-5xl lg:text-6xl font-bold text-foreground leading-[1.1] mb-4">
              Tutorials
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Short video walkthroughs for every feature in Prompt. Search or
              filter by category to find what you need.
            </p>
          </div>

          {/* Centered search bar + filter button */}
          <div className="max-w-2xl mx-auto mb-12">
            <div className="relative flex items-center gap-3" ref={filterRef}>
              <div className="relative flex-1">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tutorials..."
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
                  filtersOpen || hasActiveFilter
                    ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                    : "bg-card text-muted-foreground border-border/60 hover:text-foreground hover:border-border"
                }`}
              >
                <SlidersHorizontal size={18} />
                <span className="hidden sm:inline">Filter</span>
                {hasActiveFilter && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold">
                    1
                  </span>
                )}
              </button>

              {/* Filter dropdown */}
              <AnimatePresence>
                {filtersOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute right-0 top-full mt-2 z-20 bg-card border border-border/60 rounded-2xl shadow-xl shadow-black/10 p-4 min-w-[280px]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-foreground">
                        Category
                      </span>
                      {hasActiveFilter && (
                        <button
                          onClick={() => setActiveCategory(null)}
                          className="text-xs text-violet-600 hover:text-violet-700 font-semibold transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tutorialCategories.map((cat) => {
                        const isActive = activeCategory === cat;
                        return (
                          <button
                            key={cat}
                            onClick={() =>
                              setActiveCategory(isActive ? null : cat)
                            }
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Result count */}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing {filteredTutorials.length} of {tutorials.length} tutorials
            </p>
          </div>

          {/* Tutorial grid — single column, full-width cards */}
          <div className="grid grid-cols-1 gap-8">
            {filteredTutorials.map((tutorial, i) => (
              <TutorialCard key={tutorial.id} tutorial={tutorial} index={i} />
            ))}
          </div>

          {/* Empty state */}
          <AnimatePresence>
            {filteredTutorials.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center py-20"
              >
                <p className="text-lg text-muted-foreground mb-4">
                  No tutorials match your search.
                </p>
                <button
                  onClick={() => {
                    setQuery("");
                    setActiveCategory(null);
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
