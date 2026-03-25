"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  SlidersHorizontal,
  Play,
  FileText,
  BookOpen,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

import {
  guides,
  guideCategories,
  guideTypes,
  guideTypeLabels,
  categoryColors,
} from "@/app/(marketing)/guides/data";
import type { GuideCategory, GuideType, Guide } from "@/app/(marketing)/guides/data";
import { guideIllustrations } from "@/components/marketing/guide-illustrations";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { IconButtonWithText } from "@/components/ui/icon-button-with-text";
import { ButtonWithText } from "@/components/ui/button-with-text";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// ─── Sort options ────────────────────────────────────────────────────────────

type SortOption = "title-asc" | "title-desc" | "category-asc" | "type-asc";

function sortGuides(list: Guide[], sort: SortOption): Guide[] {
  const sorted = [...list];
  switch (sort) {
    case "title-asc":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "title-desc":
      return sorted.sort((a, b) => b.title.localeCompare(a.title));
    case "category-asc":
      return sorted.sort((a, b) => a.category.localeCompare(b.category));
    case "type-asc":
      return sorted.sort((a, b) => a.type.localeCompare(b.type));
    default:
      return sorted;
  }
}

// ─── Tutorial card (video, autoplay in viewport) ─────────────────────────────

function OverlayTutorialCard({ guide }: { guide: Guide }) {
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
          if (video.currentTime < 9) video.currentTime = 9;
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
          <div className="aspect-[16/10] bg-muted rounded-xl overflow-hidden border border-border/60 shadow-sm shadow-black/5">
            <video
              ref={videoRef}
              src={guide.videoPath}
              controls
              muted
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Article card (text + illustration/screenshot) ───────────────────────────

function OverlayArticleCard({ guide }: { guide: Guide }) {
  const colors = categoryColors[guide.category];
  const hasLink = !!guide.href;
  const Illustration = guideIllustrations[guide.id];
  const [isHovered, setIsHovered] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

        {/* Right side — illustration, screenshot, or placeholder */}
        {Illustration ? (
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
                className="w-full h-full object-cover"
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
    return (
      <Link href={guide.href!} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </Link>
    );
  }

  return content;
}

// ─── Long-form guide card ────────────────────────────────────────────────────

function OverlayLongformCard({ guide }: { guide: Guide }) {
  const colors = categoryColors[guide.category];

  return (
    <Link href={guide.href!} target="_blank" rel="noopener noreferrer" className="block">
      <div className="group bg-card border border-border/60 rounded-2xl overflow-hidden shadow-md shadow-black/[0.07] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
        <div className="px-8 py-7">
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
      </div>
    </Link>
  );
}

// ─── Card dispatcher ─────────────────────────────────────────────────────────

function OverlayGuideCard({ guide }: { guide: Guide }) {
  if (guide.type === "tutorial") return <OverlayTutorialCard guide={guide} />;
  if (guide.type === "guide") return <OverlayLongformCard guide={guide} />;
  return <OverlayArticleCard guide={guide} />;
}

// ─── Main overlay ────────────────────────────────────────────────────────────

interface GuidesOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function GuidesOverlay({ open, onClose }: GuidesOverlayProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<GuideCategory | null>(null);
  const [activeType, setActiveType] = useState<GuideType | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("title-asc");
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveCategory(null);
      setActiveType(null);
      setSortBy("title-asc");
      setShowFilters(false);
      setTimeout(() => searchRef.current?.focus(), 150);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const filteredGuides = useMemo(() => {
    const filtered = guides.filter((g) => {
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
    return sortGuides(filtered, sortBy);
  }, [query, activeCategory, activeType, sortBy]);

  const activeFilterCount = (activeCategory ? 1 : 0) + (activeType ? 1 : 0);

  const clearAllFilters = () => {
    setQuery("");
    setActiveCategory(null);
    setActiveType(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-40"
        >
          {/* Backdrop — semi-transparent with blur */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Scrollable area — starts just below the header */}
          <div
            className="absolute top-[5rem] left-0 right-0 bottom-0 overflow-y-auto"
            onClick={onClose}
          >
            {/* Content — clicks here don't close */}
            <div
              className="max-w-screen-xl mx-auto px-4 pt-4 pb-12"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Controls card ── */}
              <Card className="mb-8">
                <CardContent className="space-y-4">
                  {/* Search + toolbar row */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    {/* Search input */}
                    <div className="relative flex-1 max-w-sm">
                      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={searchRef}
                        placeholder="Search guides..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9 hover:border-foreground/20"
                      />
                      {query && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                          onClick={() => setQuery("")}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>

                    {/* Controls toolbar */}
                    <div className="flex gap-2 sm:ml-auto items-start">
                      <IconButtonWithText
                        type="button"
                        variant={showFilters ? "amber" : "violet"}
                        onClick={() => setShowFilters((v) => !v)}
                        title={showFilters ? "Close filters" : "Open filters"}
                      >
                        <SlidersHorizontal className="h-5 w-5" />
                        {showFilters ? "Close Filters" : "Filter"}
                      </IconButtonWithText>
                      <div className="w-px h-6 bg-border mx-1" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                          <SelectTrigger className="h-9 min-w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="title-asc">Name (A-Z)</SelectItem>
                            <SelectItem value="title-desc">Name (Z-A)</SelectItem>
                            <SelectItem value="category-asc">Category (A-Z)</SelectItem>
                            <SelectItem value="type-asc">Type (A-Z)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible filter panel */}
                  {showFilters && (
                    <div className="border-t border-border pt-4 space-y-4">
                      {/* Type + Clear */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</span>
                          <div className="flex flex-wrap gap-2">
                            {guideTypes.map((t) => (
                              <ButtonWithText
                                key={t}
                                onClick={() => setActiveType(activeType === t ? null : t)}
                                isSelected={activeType === t}
                                variant="muted"
                              >
                                {guideTypeLabels[t]}
                              </ButtonWithText>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide invisible">Clear</span>
                          <IconButtonWithText
                            type="button"
                            variant="destructive"
                            onClick={clearAllFilters}
                            title="Clear all filters"
                          >
                            <X className="h-5 w-5" />
                            Clear all filters
                          </IconButtonWithText>
                        </div>
                      </div>

                      {/* Category */}
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</span>
                        <div className="flex flex-wrap gap-2">
                          {guideCategories.map((cat) => (
                            <ButtonWithText
                              key={cat}
                              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                              isSelected={activeCategory === cat}
                              variant="muted"
                            >
                              {cat}
                            </ButtonWithText>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Results count — bottom left */}
                  <div className="text-sm font-medium text-foreground/70">
                    Showing <span className="font-semibold text-foreground">{filteredGuides.length}</span> of <span className="font-semibold text-foreground">{guides.length}</span> guides
                  </div>
                </CardContent>
              </Card>

              {/* Guide cards — full size */}
              <div className="grid grid-cols-1 gap-8">
                {filteredGuides.map((guide) => (
                  <OverlayGuideCard key={guide.id} guide={guide} />
                ))}
              </div>

              {/* Empty state */}
              {filteredGuides.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-lg text-muted-foreground mb-4">
                    No guides match your search.
                  </p>
                  <button
                    onClick={clearAllFilters}
                    className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {/* Link to full guides page */}
              <div className="mt-8 text-center">
                <Link
                  href="/guides"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  View all guides in full page
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
